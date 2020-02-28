const config = require('./config-wrapper.js')();
const async = require('async');
const noble = require('@abandonware/noble');
const readline = require('readline');
const mqtt = require('mqtt');

const ANKI_STR_SERVICE_UUID = 'be15beef6186407e83810bd89c4d8df4';
const ANKI_STR_CHR_READ_UUID = 'be15bee06186407e83810bd89c4d8df4';
const ANKI_STR_CHR_WRITE_UUID = 'be15bee16186407e83810bd89c4d8df4';

var ankiNodeUtils = require('./ankiUtils.js')();

const prepareMessages = require('./prepareMessages.js')();
const receivedMessages = require('./parseMessage.js')();

var ankiCarName;            // name of the car from the configuration
var ankiCarModel;           // car model name derived from the manufacturer data
var ankiCar;                // car Bluetooth peripheral
var readCharacteristic;
var writeCharacteristic;
var ankiCarLane;


config.read(process.argv[2], function (carName, carId, startlane, mqttClient) {

  if (!carId) {
    console.log('Define carid in a properties file and pass in the name of the file as argv');
    process.exit(0);
  }
  ankiCarLane = startlane;

  noble.on('stateChange', function (state) {
    console.log("BTLE State changed: " + state);
    if (state === 'poweredOn') {
      console.log("BTLE device connected");
      noble.startScanning();
      setTimeout(function () {
        console.log("Stop scanning");
        noble.stopScanning();
      }, 2000);
    } else {
      console.log("Stop scanning");
      noble.stopScanning();
    }
  });

  noble.on('discover', function (peripheral) {
    if (peripheral.id === carId) {
      noble.stopScanning();

      var manufacturerData = peripheral.advertisement.manufacturerData;

      if (manufacturerData != null) {
        var model_data = manufacturerData[3];
        ankiCarModel = ankiNodeUtils.getModelName(model_data);

        // if no name has been specified for the car use the model name
        ankiCarName = carName;
        if (carName == "")
          ankiCarName = ankiCarModel;

        var serviceUuids = JSON.stringify(peripheral.advertisement.serviceUuids);
        if (serviceUuids.indexOf(ANKI_STR_SERVICE_UUID) > -1) {
          console.log('Car discovered ID: ' + peripheral.id);
          setUp(ankiCarName, ankiCarLane, peripheral).then(function (fulfilled) {
            ankiCar = fulfilled;

            // subscribe to the messages coming from the car
            readCharacteristic.subscribe();

            // setup a handler for the messages
            readCharacteristic.on('data', function (data, isNotification) {
              receivedMessages.parse(ankiCarName, carId, data, mqttClient);
            });

          }).catch(function (error) {
            console.log(error);
          });
        }
      }
    }
  });

  function setUp(name, lane, peripheral) {
    // register a disconnect handler
    peripheral.on('disconnect', function () {
      console.log('Car has been disconnected: ' + name);
      process.exit(0);
    });

    var connectPromise = new Promise(
      function (resolve, reject) {
        if (peripheral.state == 'connected') {
          // already connected
          resolve(peripheral);
          return;
        }

        peripheral.connect(function (error) {
          if (error) {
            reject('Unable to connect to: ' + name + ' [' + peripheral.id + ']');
          } else {
            console.log('Connected to: ' + name + ' [' + peripheral.id + ']');

            peripheral.discoverServices([ANKI_STR_SERVICE_UUID], function (error, services) {
              var service = services[0];

              service.discoverCharacteristics([], function (error, characteristics) {
                for (var i = 0; i < characteristics.length; i++) {
                  var characteristic = characteristics[i];
                  if (characteristic.uuid == ANKI_STR_CHR_READ_UUID) {
                    readCharacteristic = characteristic;

                  }
                  if (characteristic.uuid == ANKI_STR_CHR_WRITE_UUID) {
                    writeCharacteristic = characteristic;

                    // enable SDK mode for this car
                    ankiNodeUtils.turnOnSdkMode(writeCharacteristic);

                    // define the lane the car is in
                    var initialOffset = 0.0;
                    if (lane) {
                      if (lane == '1') initialOffset = 68.0;
                      if (lane == '2') initialOffset = 23.0;
                      if (lane == '3') initialOffset = -23.0;
                      if (lane == '4') initialOffset = -68.0;
                    }
                    ankiNodeUtils.setLaneOffset(writeCharacteristic, initialOffset);
                  }
                }
                resolve(peripheral);
                return;
              });
            });
          }
        });
      }
    );
    return connectPromise;
  }

  mqttClient.on('error', function (err) {
    console.error('MQTT client error ' + err);
    mqttClient = null;
  });

  mqttClient.on('close', function () {
    console.log('MQTT client closed');
    mqttClient = null;
  });

  mqttClient.on('message', function (topic, message, packet) {
    var msg = JSON.parse(message.toString());

    if (msg.d.action == '#s') {
      var cmd = "s";
      if (msg.d.speed) {
        cmd = cmd + " " + msg.d.speed;
      }
      invokeCommand(cmd, readCharacteristic, writeCharacteristic);
    }
    //   else if (msg.d.action == '#c') {
    //     var cmd = "c";
    //     if (msg.d.offset) {
    //       cmd = cmd + " " + msg.d.offset;
    //     }
    //     invokeCommand(cmd);
    //   }
    //   else if (msg.d.action == '#q') {
    //     var cmd = "q";
    //     invokeCommand(cmd);
    //   }
    //   else if (msg.d.action == '#ping') {
    //     var cmd = "ping";
    //     invokeCommand(cmd);
    //   }
    //   else if (msg.d.action == '#ver') {
    //     var cmd = "ver";
    //     invokeCommand(cmd);
    //   }
    //   else if (msg.d.action == '#bat') {
    //     var cmd = "bat";
    //     invokeCommand(cmd);
    //   }
    //   else if (msg.d.action == '#l') {
    //     var cmd = "l";
    //     invokeCommand(cmd);
    //   }
    //   else if (msg.d.action == '#lp') {
    //     var cmd = "lp";
    //     invokeCommand(cmd);
    //   }
  });
});

function invokeCommand(cmd) {
  if (readCharacteristic && writeCharacteristic) {
    prepareMessages.invoke(cmd, readCharacteristic, writeCharacteristic);
  } else {
    console.log('Error sending command');
  }
}

const cli = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
cli.setPrompt('> ');
cli.prompt();

cli.on('line', function (cmd) {
  if (cmd == "help") {
    console.log(prepareMessages.doc());
  } else {
    invokeCommand(cmd);
  }

  cli.prompt();
});

process.stdin.resume();

function exitHandler(option, err) {
  // disconnect from the car
  if (ankiCar)
    ankiCar.disconnect();
}

process.on('exit', exitHandler.bind(null, { cleanup: true }));
process.on('SIGINT', exitHandler.bind(null, { exit: true }));
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
