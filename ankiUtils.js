const async = require('async');
const noble = require('@abandonware/noble');
const uuidvalidator = require('validator');
var messageParse = require('./messageParse.js')();

const MAX_BATTERY_LEVEL = 4200;
const ANKI_STR_SERVICE_UUID = 'be15beef6186407e83810bd89c4d8df4';
const ANKI_STR_CHR_READ_UUID = 'be15bee06186407e83810bd89c4d8df4';
const ANKI_STR_CHR_WRITE_UUID = 'be15bee16186407e83810bd89c4d8df4';
const ANKI_VEHICLE_MSG_C2V_DISCONNECT = 0x0d;
const ANKI_VEHICLE_MSG_C2V_PING_REQUEST = 0x16;
const ANKI_VEHICLE_MSG_V2C_PING_RESPONSE = 0x17;
const ANKI_VEHICLE_MSG_C2V_VERSION_REQUEST = 0x18;
const ANKI_VEHICLE_MSG_V2C_VERSION_RESPONSE = 0x19;
const ANKI_VEHICLE_MSG_C2V_BATTERY_LEVEL_REQUEST = 0x1a;
const ANKI_VEHICLE_MSG_V2C_BATTERY_LEVEL_RESPONSE = 0x1b;
const ANKI_VEHICLE_MSG_C2V_SET_LIGHTS = 0x1d;
const ANKI_VEHICLE_MSG_C2V_SET_SPEED = 0x24;
const ANKI_VEHICLE_MSG_C2V_CHANGE_LANE = 0x25;
const ANKI_VEHICLE_MSG_C2V_CANCEL_LANE_CHANGE = 0x26;
const ANKI_VEHICLE_MSG_V2C_LOCALIZATION_POSITION_UPDATE = 0x27;
const ANKI_VEHICLE_MSG_V2C_LOCALIZATION_TRANSITION_UPDATE = 0x29;
const ANKI_VEHICLE_MSG_V2C_LOCALIZATION_INTERSECTION_UPDATE = 0x2a;
const ANKI_VEHICLE_MSG_V2C_VEHICLE_DELOCALIZED = 0x2b;
const ANKI_VEHICLE_MSG_C2V_SET_OFFSET_FROM_ROAD_CENTER = 0x2c;
const ANKI_VEHICLE_MSG_V2C_OFFSET_FROM_ROAD_CENTER_UPDATE = 0x2d;
const ANKI_VEHICLE_MSG_C2V_TURN = 0x32;
const ANKI_VEHICLE_MSG_C2V_LIGHTS_PATTERN = 0x33;
const ANKI_VEHICLE_MSG_C2V_SET_CONFIG_PARAMS = 0x45;
const ANKI_VEHICLE_MSG_C2V_SDK_MODE = 0x90;
const ANKI_VEHICLE_SDK_OPTION_OVERRIDE_LOCALIZATION = 0x01;

class ankiCar {

  constructor(name, id) {
    this._name = name;            // true car name (Guardian)
    this._id = id.toLowerCase();  // car ID (serial number in MACID format)
    this._peripheral = null;      // bluetooth peripheral identifier
    this._reader = null;          // bluetooth writer characteristic
    this._writer = null;          // bluetooth reader characteristic
  }

  set name(name) {
    this._name = name;
  }

  get name() {
    return this._name;
  }

  set peripheral(peripheral) {
    this._peripheral = peripheral; // bluetooth peripheral
    this._id = peripheral.address.toLowerCase();
  }

  get peripheral() {
    return this._peripheral;
  }

  set readerCharacteristic(characteristic) {
    this._reader = characteristic;
  }

  get readerCharacteristic() {
    return this._reader;
  }

  set writerCharacteristic(characteristic) {
    this._writer = characteristic;
  }

  get writerCharacteristic() {
    return this._writer;
  }

  isCar(carIdentifier) {
    // test if the identifier is in MAC address format
    if (uuidvalidator.isMACAddress(carIdentifier)) {
      // UUID for the car is passed
      if (this._id == carIdentifier.toLowerCase()) {
        return true;
      } else {
        return false;
      }
    } else {
      // car name is to be tested
      if (this._name == carIdentifier) {
        return true;
      } else {
        return false;
      }
    }
  }
}

var ankiCarMap = new Map();

const carIDNameMap = new Map([
  [8, "Ground Shock"],
  [9, "Skull"],
  [10, "Thermo"],
  [11, "Nuke"],
  [12, "Guardian"],
  [15, "Free Wheel"],
  [16, "X52"],
  [17, "X52 Ice"],
  [18, "MXT"],
  [19, "ICE Charger"]
]);

//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////
// Bluetooth Utilities
//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////

noble.on('stateChange', function (state) {
  console.log("BTLE State changed: " + state);
  if (state === 'poweredOn') {
    console.log("Start scanning");
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
  var manufacturerData = peripheral.advertisement.manufacturerData;

  if (manufacturerData != null) {
    var model_data = manufacturerData[3]
    var carName = carIDNameMap.get(model_data);

    if (carName != undefined) {
      var address = peripheral.address;
      var newCar = new ankiCar(carName, address);
      newCar.peripheral = peripheral;

      // test if this car name already exists in the map
      var mapKeyName = carName;
      var index = 1;
      while (ankiCarMap.get(mapKeyName) != undefined) {
        // car with this name exists in the map already so create a new key name
        index++;
        mapKeyName = carName + ' (' + index + ')';
      }

      // add this new named car to the map
      console.log("Added car: " + mapKeyName + " Type: " + carName + " Address: [" + address + "]");
      ankiCarMap.set(mapKeyName, newCar);
    }
  }
});

noble.on('disconnect', function (peripheral) {
  console.log("BTLE: disconnect called");
});

//////////////////////////////////////////////////////////
// Rescan
//////////////////////////////////////////////////////////
var rescan = function () {
  ankiCarMap.clear();

  noble.startScanning();

  setTimeout(function () {
    noble.stopScanning();
  }, 4000);
}

//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////
// Anki Utilities
//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////
// Turn on sdk mode
//////////////////////////////////////////////////////////
var turnOnSdkMode = function (writerCharacteristic) {
  var sdkMessage = new Buffer(4);
  sdkMessage.writeUInt8(0x03, 0); // Msg Size
  sdkMessage.writeUInt8(ANKI_VEHICLE_MSG_C2V_SDK_MODE, 1);
  sdkMessage.writeUInt8(0x01, 2); // 0 = off / 1 = on
  sdkMessage.writeUInt8(ANKI_VEHICLE_SDK_OPTION_OVERRIDE_LOCALIZATION, 3); // OVERRIDE_LOCALIZATION (needed for other apis)
  writerCharacteristic.write(sdkMessage, false, function (err) {});
}

//////////////////////////////////////////////////////////
// Turn on logging for a given car
////////////////////////////////////////l//////////////////
var turnOnLogging = function (carName) {
  getReaderCharacteristic(carName).then(function (readerCharacteristic) {
    readerCharacteristic.subscribe();
    readerCharacteristic.on('data', function (data, isNotification) {
      messageParse.parse(carName, data);
    });
  });
}


//////////////////////////////////////////////////////////
// Set Lane Offset - What lane the car should 'start' in.
//////////////////////////////////////////////////////////
var setLaneOffset = function (carName, change) {
  getWriterCharacteristic(carName).then(function (writerCharacteristic) {
    offsetMessage = new Buffer(6);
    offsetMessage.writeUInt8(0x05, 0); // ANKI_VEHICLE_MSG_C2V_SET_OFFSET_FROM_ROAD_CENTER_SIZE
    offsetMessage.writeUInt8(0x2c, 1); // ANKI_VEHICLE_MSG_C2V_SET_OFFSET_FROM_ROAD_CENTER
    offsetMessage.writeFloatLE(parseFloat(change), 2); // Offset value (?? 68,23,-23,68 seem to be lane values 1-4)

    console.log("Sending lane offset: " + change);
    writerCharacteristic.write(offsetMessage, false, function (err) {
      if (err) {
        console.log("Error: " + util.inspect(err, false, null));
      } else {
        console.log("Success");
      }
    });
  });
}

//////////////////////////////////////////////////////////
// Disconnect from a given car
//////////////////////////////////////////////////////////
var disconnectCar = function (carName) {
  console.log("Disconnect from car: " + carName);
  var ankiCar = null;

  ankiCar = ankiCarMap.get(carName);
  if (ankiCar == undefined) {
    // car is not in the list
    return ("Car already disconnected.");
  }

  // if (peripheral == null) {
  //   return ("Car already disconnected.");//TBD: Do a rescan and try again...
  // }

  var peripheral = ankiCar.peripheral;
  peripheral.disconnect(function (error) {
    console.log("Disconnected from " + carName);
    ankiCar.readerCharacteristic = null;
    ankiCar.writerCharacteristic = null;
  });
}

//////////////////////////////////////////////////////////
// Connect to a given car
//////////////////////////////////////////////////////////
var connectCar = function (carName) {
  console.log("Making connection to car: " + carName);
  // Note: The car name can be the actual name or the address.
  // If only one of a given car 'e.g. Skull' is around, it is easier to use the name.
  // If two or more cars with the same name are around, it is best to use the address.
  var ankiCar = null;

  // get car using name..need to check if ID is used
  var ankiCar = ankiCarMap.get(carName);

  if (ankiCar == undefined) {
    return ("Car not found");//TBD: Do a rescan and try again...
  }

  var peripheral = ankiCar.peripheral;

  // This connection is async, so return a promise.
  var connectPromise = new Promise(
    function (resolve, reject) {
      peripheral.connect(function (error) {
        console.log("Connected to " + ankiCar.name + " : " + peripheral.uuid);
        peripheral.discoverServices([ANKI_STR_SERVICE_UUID], function (error, services) {
          var service = services[0];

          service.discoverCharacteristics([], function (error, characteristics) {
            var characteristicIndex = 0;

            for (var i = 0; i < characteristics.length; i++) {
              var characteristic = characteristics[i];
              if (characteristic.uuid == ANKI_STR_CHR_READ_UUID) {
                ankiCar.readerCharacteristic = characteristic;
              }

              if (characteristic.uuid == ANKI_STR_CHR_WRITE_UUID) {
                ankiCar.writerCharacteristic = characteristic;
                turnOnSdkMode(ankiCar.writerCharacteristic);
              }
            }
            resolve();
            return;
          });
        });
      });
    });
  return (connectPromise);
}

//////////////////////////////////////////////////////////
// Get a readerCharacteristic for a given car.
// If one doesn't exist, try to connect to the car first.
//////////////////////////////////////////////////////////
function getReaderCharacteristic(carName) {
  var getReaderPromise = new Promise(
    function (resolve, reject) {
      var ankiCar = ankiCarMap.get(carName);
      if (ankiCar == undefined) {
        reject("Cannot find car in map.");
        return;
      }

      if (ankiCar.readerCharacteristic != null) {
        console.log("Resolved reader without connect.");
        resolve(ankiCar.readerCharacteristic);
        return;
      }

      // If we are here, there was no reader... we need to try and connect.
      connectCar(carName).then(function (res) {
        if (ankiCar.readerCharacteristic != null) {
          console.log("Resolved reader after connect.");
          resolve(ankiCar.readerCharacteristic);
          return;
        }
      });

      reject("Cannot get reader.");
  });
  return (getReaderPromise);
}

//////////////////////////////////////////////////////////
// Get a writerCharacteristic for a given car.
// If one doesn't exist, try to connect to the car first.
//////////////////////////////////////////////////////////
function getWriterCharacteristic(carName) {
  var getWriterPromise = new Promise(
    function (resolve, reject) {
      // find the car
      var ankiCar = ankiCarMap.get(carName);
      if (ankiCar == undefined) {
        reject("Cannot find the car in the map.");
        return;
      }

      if (ankiCar.writerCharacteristic != null) {
        console.log("Resolved writer without connect.");
        resolve(ankiCar.writerCharacteristic);
        return;
      }

      // One does not exist, try to create one.
      connectCar(carName).then(function (res) {
        // Try again after connect.
        if (ankiCar.writerCharacteristic != null) {
          console.log("Resolved writer with connect.");
          resolve(ankiCar.writerCharacteristic);
          return;
        }
      });

      reject("Could not get writer.");
    });
  return (getWriterPromise);
}

//define LIGHT_HEADLIGHTS    0
//define LIGHT_BRAKELIGHTS   1
//define LIGHT_FRONTLIGHTS   2
//define LIGHT_ENGINE        3
var setLights = function (carName, lightValue) {
  var lightMessage = new Buffer(3);
  lightMessage.writeUInt8(0x02, 0);
  lightMessage.writeUInt8(0x1d, 1); // ANKI_VEHICLE_MSG_C2V_SET_LIGHTS
  lightMessage.writeUInt8(lightValue, 2); // Bits 0-3 (mask.  Could always be F) Bits 4-7 (Head/Tail/Brake/???)
  // E.g. 0x44 ('set' 'headlights')

  console.log("set lights: Getting writer char");
  getWriterCharacteristic(carName).then(function (writerCharacteristic) {
    if (writerCharacteristic != null) {
      console.log("Turn on lights");
      writerCharacteristic.write(lightMessage, false, function (err) {
        if (err) {
          console.log("Error: " + util.inspect(err, false, null));
        } else {
          console.log("Set LightsSuccess");
        }
      });
    }
  });
}

// The lights API for ANKI seems to have changed for Overdrive.  The set lights still works, to some extent, but not used in the game.
// This 'Set Pattern' APi is used for all the lighting.  However, the API now uses 17bytes rather than 8.  I have not figured them
// all out.  I sorted out basic STEADY RGB; which was good enough for now.
//
// Set lights pattern
// Game: 0x15 0x00 0x04 0x00 0x52 0x0b 0x00 0x11 0x33 0x03 0x00 0x00 0x00 0x00 0x00 0x03 0x00 0x00 0x00 0x00 0x02 0x00 0x0e 0x0e 0x00 0xfc 0x01 0xa8 // Blue
// Game: 0x15 0x00 0x04 0x00 0x52 0x0b 0x00 0x11 0x33 0x03 0x00 0x00 0x0a 0x0a 0x00 0x03 0x00 0x00 0x00 0x00 0x02 0x00 0x00 0x00 0x00 0x7e 0x8c 0xc2 // Red
// Game: 0x15 0x00 0x04 0x00 0x52 0x0b 0x00 0x11 0x33 0x03 0x00 0x00 0x00 0x00 0x00 0x03 0x00 0x0a 0x0a 0x00 0x02 0x00 0x00 0x00 0x00 0x37 0x9a 0x07 // Green
// Game: 0x15 0x00 0x04 0x00 0x52 0x0b 0x00 0x11 0x33 0x03 0x00 0x00 0x0a 0x0a 0x00 0x03 0x00 0x00 0x00 0x00 0x02 0x00 0x0a 0x0a 0x00 0x68 0xd2 0x79 // Purple

// Brake Lights:(works)
// Game: 0x15 0x00 0x04 0x00 0x52 0x0b 0x00 0x11 0x33 0x01 0x01 0x00 0x0e 0x0e 0x00 0x08 0x00 0x00 0x00 0x81 0x51 0x7d 0x79 0xf4 0xeb 0x5a 0xd8 0xbe

var setEngineLight = function (carName, red, green, blue) {
  // New API.
  var lightsPatternMessage = new Buffer(18);
  lightsPatternMessage.writeUInt8(0x11, 0); // Buffer Size
  lightsPatternMessage.writeUInt8(ANKI_VEHICLE_MSG_C2V_LIGHTS_PATTERN, 1);
  lightsPatternMessage.writeUInt8(0x03, 2);
  lightsPatternMessage.writeUInt8(0x00, 3);
  lightsPatternMessage.writeUInt8(0x00, 4);
  lightsPatternMessage.writeUInt8(red, 5); // Red Start?
  lightsPatternMessage.writeUInt8(red, 6); // Red End?
  lightsPatternMessage.writeUInt8(0x00, 7);
  lightsPatternMessage.writeUInt8(0x03, 8);
  lightsPatternMessage.writeUInt8(0x00, 9);
  lightsPatternMessage.writeUInt8(green, 10); // Green Start?
  lightsPatternMessage.writeUInt8(green, 11); // Green End?
  lightsPatternMessage.writeUInt8(0x00, 12);
  lightsPatternMessage.writeUInt8(0x02, 13); // 2=Solid. Anything else acts like Pulse
  lightsPatternMessage.writeUInt8(0x00, 14);
  lightsPatternMessage.writeUInt8(blue, 15); // Blue start? 
  lightsPatternMessage.writeUInt8(blue, 16); // Blue End?
  lightsPatternMessage.writeUInt8(0x00, 17);

  console.log("set engine lights: ", lightsPatternMessage);
  getWriterCharacteristic(carName).then(function (writerCharacteristic) {
    console.log("Turn on lights");
    writerCharacteristic.write(lightsPatternMessage, false, function (err) {
      if (err) {
        console.log("Error: " + util.inspect(err, false, null));
      } else {
        console.log("Set LightsSuccess");
      }
    });
  });
}

//////////////////////////////////////////////////////////
// Make car do a U-Turn
//////////////////////////////////////////////////////////
var uTurn = function (carName) {
  var uTurnMessage = new Buffer(4);
  uTurnMessage.writeUInt8(0x03, 0);
  uTurnMessage.writeUInt8(ANKI_VEHICLE_MSG_C2V_TURN, 1);
  uTurnMessage.writeUInt8(0x03, 2); // u turn
  uTurnMessage.writeUInt8(0x00, 3); // turn 0 = immediately, 1 = at next track junction 

  getWriterCharacteristic(carName).then(function (writerCharacteristic) {
    if (writerCharacteristic != null) {
      console.log("U-Turn");
      writerCharacteristic.write(uTurnMessage, false, function (err) {
        if (err) {
          console.log("Error: " + util.inspect(err, false, null));
        } else {
          console.log("U-Turn Success");
        }
      });
    }
  });
}

//////////////////////////////////////////////////////////
// Set car speed
// 0x0a 0x00 0x04 0x00 0x12 0x0b 0x00 0x06 0x24 0x54 0x01 0xe8 0x03 0x00 0x3b 0xbc 0xa1
//////////////////////////////////////////////////////////
var setSpeed = function (carName, speed) {
  getWriterCharacteristic(carName).then(function (writerCharacteristic) {
    var speedMessage = new Buffer(7);
    speedMessage.writeUInt8(0x06, 0);
    speedMessage.writeUInt8(ANKI_VEHICLE_MSG_C2V_SET_SPEED, 1);
    speedMessage.writeInt16LE(speed, 2);
    speedMessage.writeInt16LE(1000, 4);

    writerCharacteristic.write(speedMessage, false, function (err) {
      if (err) {
        console.log("Error: " + util.inspect(err, false, null));
      } else {
        console.log("Set Speed Success");
      }
    });
  });
}

//////////////////////////////////////////////////////////
// Change lanes
//////////////////////////////////////////////////////////
var changeLanes = function (carName, change) {
  // To change lanes, we need to make two calls (Based on vehicle_cmd.c from sdk)
  // anki_vehicle_msg_set_offset_from_road_center
  // anki_vehicle_msg_change_lane

  // Step 1. anki_vehicle_msg_set_offset_from_road_center
  //
  getWriterCharacteristic(carName).then(function (writerCharacteristic) {
    var changeMessage = new Buffer(12);
    changeMessage.writeUInt8(11, 0); // ANKI_VEHICLE_MSG_C2V_CHANGE_LANE_SIZE
    changeMessage.writeUInt8(ANKI_VEHICLE_MSG_C2V_CHANGE_LANE, 1);
    changeMessage.writeInt16LE(250, 2); // horizontal_speed_mm_per_sec
    changeMessage.writeInt16LE(1000, 4); // horizontal_accel_mm_per_sec2
    changeMessage.writeFloatLE(parseFloat(change), 6); // offset_from_road_center_mm

    console.log("Sending lane change: " + change);
    writerCharacteristic.write(changeMessage, false, function (err) {
      if (err) {
        console.log("Error: " + util.inspect(err, false, null));
      } else {
        console.log("Success");
      }
    });
  });
}

//////////////////////////////////////////////////////////
// Get Battery Levels
//////////////////////////////////////////////////////////
var batteryLevel = function (carName) {
  getWriterCharacteristic(carName).then(function (writerCharacteristic) {
    var message = new Buffer(2);
    message.writeUInt8(0x01, 0);
    message.writeUInt8(ANKI_VEHICLE_MSG_C2V_BATTERY_LEVEL_REQUEST, 1);

    writerCharacteristic.write(message, false, function (err) {
      if (err) {
        console.log("Error: " + util.inspect(err, false, null));
      } else {
        console.log("Request Battery Level Success");
      }
    });
  });
}

//////////////////////////////////////////////////////////
// Ping / Response
//////////////////////////////////////////////////////////
var ping = function (carName) {
  var pingPromise = new Promise(
    function (resolve, reject) {
      getReaderCharacteristic(carName).then(function (readerCharacteristic) {
        async.parallel([
          function (callback) {  // Turn on reader notifications
            console.log("set notify true");
            readerCharacteristic.notify(true, function (err) {
            });
            callback();
          },
          function (callback) { // Read data until we get ping response
            console.log("setting up process data function");
            function processData(data, isNotification) {
              console.log("process data function called.");
              var messageId = data.readUInt8(1);
              if (messageId == ANKI_VEHICLE_MSG_V2C_PING_RESPONSE) {
                console.log("Found ping msg.");
                replyData = "Success";
                readerCharacteristic.removeListener('read', processData);
                callback();
              }
            }
            readerCharacteristic.on('read', processData);
          },
          function (callback) { // Write the request to ping
            console.log("running writer.");
            message = new Buffer(2);
            message.writeUInt8(0x01, 0);
            message.writeUInt8(ANKI_VEHICLE_MSG_C2V_PING_REQUEST, 1);
            getWriterCharacteristic(carName).then(function (writerCharacteristic) {
              writerCharacteristic.write(message, false, function (err) {
                if (err) {
                  console.log("Error: " + util.inspect(err, false, null));
                } else {
                  console.log("Request Battery Level Success");
                }
              });
              callback();
            });
          }],
          function (err) { /// Done... build reply
            console.log("Ping Response: ", replyData);
            resolve(replyData);
            return;
          }
        );
      });
    });
  return (pingPromise);
}

//////////////////////////////////////////////////////////
// Track Count Travel.  Makes a car travel 'x' number of tracks, then stops.
//////////////////////////////////////////////////////////
var trackCountTravel = function (carName, tracksToTravel, speed) {
  getReaderCharacteristic(carName).then(function (readerCharacteristic) {
    console.log("in then after getting a reader...");
    if (readerCharacteristic == null) {
      return ("Unable to find and connect to car " + carName);
    }
    var replyData = null;
    var trackCount = 0;

    console.log("Starting parallel");
    async.parallel([
      function (callback) {  // Turn on reader notifications
        readerCharacteristic.notify(true, function (err) {
        });
        callback();
      },
      function (callback) { // Read data until we get track msg
        console.log("Starting reader...");
        function processData(data, isNotification) {
          var messageId = data.readUInt8(1);
          if (messageId == '41') {  // Track event (This happens when the car transitions from one track to the next)
            trackCount = trackCount + 1;
            console.log("Track Count: " + trackCount + "/" + tracksToTravel);
            if (trackCount >= tracksToTravel) {
              // stop the car
              readerCharacteristic.removeListener('read', processData);
              callback();
            }
          }
        }
        readerCharacteristic.on('read', processData);
      },
      function (callback) { // Write the request to start the car traveling
        console.log("Starting car...");
        writerCharacteristic = getWriterCharacteristic(carName);
        setSpeed(carName, speed);
        callback();
      }],
      function (err) { /// Done... build reply
        console.log("Final call.  Stop car");
        console.log("Starting car...");
        writerCharacteristic = getWriterCharacteristic(carName);
        setSpeed(carName, 0);
        disconnectCar(carName);
      }
    );
  });
}

var mapTrack = function (carName, trackMap) {
  console.log("Map Track Start...");
  trackMap.resetTrackMap();
  //rescan(); // try to make sure we can see the car
  getReaderCharacteristic(carName).then(function (readerCharacteristic) {
    if (readerCharacteristic == null) {
      return ("Unable to find and connect to car " + carName);
    }
    var replyData = null;
    var trackCount = 0;
    var trackTransition = false;
    var startTrackCount = 0;

    console.log("Starting parallel");
    async.parallel([
      function (callback) {  // Turn on reader notifications
        readerCharacteristic.notify(true, function (err) {
        });
        callback();
      },
      function (callback) { // Read data until we get track msg
        console.log("Starting reader...");
        function processData(data, isNotification) {
          var messageId = data.readUInt8(1);
          if (messageId == ANKI_VEHICLE_MSG_V2C_LOCALIZATION_POSITION_UPDATE) {
            //console.log("Position Update...");
            if (trackTransition == true) {
              var trackLocation = data.readUInt8(2);
              var trackId = data.readUInt8(3);
              var offset = data.readFloatLE(4);
              var speed = data.readUInt16LE(8);
              var clockwise = false;
              if (data.readUInt8(10) == 0x47) {
                clockwise = true;
              }
              trackMap.addTrackToMap(trackId, clockwise);
              trackTransition = false;
              if (trackId == 33) { // Start track
                startTrackCount++;
                if (startTrackCount >= 2) {
                  // stop the car
                  readerCharacteristic.removeListener('read', processData);
                  callback();
                }
              }
            }
          } else if (messageId == 0x29) { // Track event (This happens when the car transitions from one track to the next
            console.log("Track Transition Event...");
            trackCount = trackCount + 1;
            trackTransition = true;
          }
        }
        readerCharacteristic.on('read', processData);
      },
      function (callback) { // Write the request to start the car traveling
        console.log("Starting car for mapping: " + carName);
        writerCharacteristic = getWriterCharacteristic(carName);
        setSpeed(carName, 500);
        callback();
      }],
      function (err) { /// Done... build reply
        console.log("Final call.  Stop car.  Mapping done.");
        console.log("Starting car...");
        writerCharacteristic = getWriterCharacteristic(carName);
        setSpeed(carName, 0);
      }
    );
  });
  console.log("Map Track End...");
}

module.exports = function () {
  return {
    rescan: rescan,
    connectCar: connectCar,
    disconnectCar: disconnectCar,
    turnOnSdkMode: turnOnSdkMode,
    setLaneOffset: setLaneOffset,
    setLights: setLights,
    setEngineLight: setEngineLight,
    setSpeed: setSpeed,
    turnOnLogging: turnOnLogging,
    changeLanes: changeLanes,
    uTurn: uTurn,
    ping: ping,
    batteryLevel: batteryLevel,
    trackCountTravel: trackCountTravel,
    mapTrack: mapTrack
  }
};
