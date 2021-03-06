/*
 * Copyright (C) 2020 Microchip Technology Inc.  All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const config = require('./config-wrapper.js')();
const noble = require('@abandonware/noble');
const readline = require('readline');
const events = require('events');

const carEventEmitter = new events.EventEmitter();

const ANKI_STR_SERVICE_UUID = 'be15beef6186407e83810bd89c4d8df4';
const ANKI_STR_CHR_READ_UUID = 'be15bee06186407e83810bd89c4d8df4';
const ANKI_STR_CHR_WRITE_UUID = 'be15bee16186407e83810bd89c4d8df4';

var ankiNodeUtils = require('./ankiUtils.js')();

const prepareMessages = require('./prepareMessages.js')();
const receivedMessages = require('./parseMessage.js')();

var ankiCarName;            // name of the car from the configuration
var ankiCarModel;           // car model name derived from the manufacturer data
var ankiCar;                // car Bluetooth peripheral
var ankiCarId;              // MACID of the car
var readCharacteristic;
var writeCharacteristic;

// the ankiCarLane is an estimate based upon the configuration file. Since we cannot be sure
// where a user places the car this value will be updated each time the car passes the start/finish 
// track by looking at the trackID and trackLocation values. The value stored is an absoute mm value
// from -68 to +68
var ankiCarLane;


config.read(process.argv[2], function (carName, carId, startlane, mqttClient) {

  if (!carId) {
    console.log('Define carid in a properties file and pass in the name of the file as argv');
    process.exit(0);
  }
  ankiCarId = carId;

  // define the lane the car is in
  var initialOffset = 0.0;
  if (startlane) {
    if (startlane == '1') initialOffset = 68.0;
    if (startlane == '2') initialOffset = 23.0;
    if (startlane == '3') initialOffset = -23.0;
    if (startlane == '4') initialOffset = -68.0;
  }
  ankiCarLane = initialOffset;

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
              receivedMessages.parse(ankiCarName, carId, ankiCarLane, data, mqttClient);
            });

            // publish the initial car data
            if (mqttClient) {
              mqttClient.publish('microchip/anki/car/' + carId + '/status/name',
                ankiCarName, function () {
              });     
              
              mqttClient.publish('microchip/anki/car/' + carId + '/status/type',
                ankiCarModel, function () {
              });     

              mqttClient.publish('microchip/anki/car/' + carId + '/status/id',
                ankiCarId, function () {
              });                 

              mqttClient.publish('microchip/anki/car/' + carId + '/status/connection',
                'connected', function () {
              });               
            }
          }).catch(function (error) {
            console.log(error);
          });
        }
      }
    }
  });

  // we have a special handler for the speed setter which allows speed commands
  // from the cli to be handled here to allow mqtt messages to be posted
  carEventEmitter.on('stop', function(err) {
    if (mqttClient) {
      setTimeout(function () {
        mqttClient.publish('microchip/anki/car/' + carId + '/status/speed',
          '0', function () {
        });  
      }, 1200);
    }
  });

  function setUp(name, lane, peripheral) {
    // register a disconnect handler
    peripheral.on('disconnect', function () {
      console.log('Car has been disconnected: ' + name);

      if (mqttClient) {
        mqttClient.publish('microchip/anki/car/' + carId + '/status/connection',
          'disconnected', function () {
        });   
   
        carEventEmitter.emit('stop');
      }

      //process.exit(0);
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

                    ankiNodeUtils.setLaneOffset(writeCharacteristic, lane);
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

  // mqttClient.on('error', function (err) {
  //   console.error('MQTT client error ' + err);
  //   mqttClient = null;
  // });

  mqttClient.on('close', function () {
    console.log('MQTT client closed');
    mqttClient = null;
  });

  mqttClient.on('message', function (topic, message, packet) {
    var msg = JSON.parse(message.toString());
    console.log("MSG: ", msg);
    if (msg.d.action == '#speed') {
      var cmd = "s";
      // speed commands from mqtt are assumed to always have a speed field
      cmd = cmd + " " + msg.d.speed;

      invokeCommand(cmd);

      // special case for speed 0 as feedback is not always returned from the car
      if (msg.d.speed == 0) {
        carEventEmitter.emit('stop');
      }
    }
    else if (msg.d.action == '#lane') {
      var cmd = "o";
      if (msg.d.offset) {
        cmd = cmd + " " + msg.d.offset;
      }
      invokeCommand(cmd);
    }
    else if (msg.d.action == '#startline') {
      var cmd = "sl";
      invokeCommand(cmd);
    }
    else if (msg.d.action == '#ping') {
      var cmd = "p";
      invokeCommand(cmd);
    }
    else if (msg.d.action == '#ver') {
      var cmd = "v";
      invokeCommand(cmd);
    }
    else if (msg.d.action == '#bat') {
      var cmd = "b";
      invokeCommand(cmd);
    }
    else if (msg.d.action == '#map') {
      var cmd = 'm';
      invokeCommand(cmd);

      var previousMap = prepareMessages.getMap();

      // update the map periodically
      var mapIntervalTimer = setInterval(function() {
        // output the current map
        
        var mapData = prepareMessages.getMap();
        if (mapData != null) {
          if (mapData != previousMap) {
            mqttClient.publish('microchip/anki/track', JSON.stringify(mapData), function() {
            });
            previousMap = mapData;
          }
        }

        // if the map is complete then stop the timed callback
        if (prepareMessages.isMapDone()) {
          clearInterval(mapIntervalTimer);
        }
      }, 500);
    }
    else if (msg.d.action == '#quit') {
      var cmd = 'q';
      invokeCommand(cmd);
    } 
    else if (msg.d.action == '#rescan') {
      startRescan();
    }
    else if (msg.d.action == '#getmap') {
      // get the most recent map data
      var mapData = prepareMessages.getMap();
      if (mapData != null) {
        mqttClient.publish('microchip/anki/track', JSON.stringify(mapData), function () {
        });
      }
    }
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

function startRescan() {
  console.log("Starting rescan for cars");
  // perform a rescan/discovery process for the selected device
  if (noble.state === 'poweredOn') {
    noble.startScanning();
    // discovery event will be triggered in the main handler
    setTimeout(function () {
      console.log("Stop scanning");
      noble.stopScanning();
    }, 2000);
  } 
}

function invokeCommand(cmd) {
  // handle some special cases for rescan and quit
  if (cmd == 'r') {
    // rescan for our selected device
    startRescan();
  } else if (cmd == 'q') {
    // quit the application
    process.exit(0);
  } else if (readCharacteristic && writeCharacteristic) {
    prepareMessages.invoke(cmd, readCharacteristic, writeCharacteristic);
    // special case for end/stopping the car to ensure speed 0 is propagated 
    // via mqtt
    if (cmd == 'e') {
      carEventEmitter.emit('stop');
    }
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
  // disconnect from the peripheral
  if (err) {
    console.log(err);
  }

  if (ankiCar)
    ankiCar.disconnect();
}

process.on('exit', exitHandler.bind(null, { cleanup: true }));
process.on('SIGINT', exitHandler.bind(null, { exit: true }));
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
