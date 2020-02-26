const async = require('async');
const util = require('util');
const noble = require('@abandonware/noble');
const uuidvalidator = require('validator');
var messageParse = require('./parseMessage.js')();

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
    this._connected = null;       // connected to the peripheral
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
    this._connected = false;
  }

  get peripheral() {
    return this._peripheral;
  }

  set connected(newState) {
    this._connected = newState;
  }

  get connected() {
    return this._connected;
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

var getModelName = function(model_data) {
  var modelName = carIDNameMap.get(model_data);
  if (modelName == undefined)
    modelName = "Unknown";

  return modelName;
}
//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////
// Bluetooth Utilities
//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////

// noble.on('stateChange', function (state) {
//   console.log("BTLE State changed: " + state);
//   if (state === 'poweredOn') {
//     console.log("Start scanning");
//     noble.startScanning();

//     setTimeout(function () {
//       console.log("Stop scanning");
//       noble.stopScanning();
//     }, 2000);
//   } else {
//     console.log("Stop scanning");
//     noble.stopScanning();
//   }
// });

// noble.on('discover', function (peripheral) {
//   var manufacturerData = peripheral.advertisement.manufacturerData;

//   if (manufacturerData != null) {
//     var model_data = manufacturerData[3]
//     var carName = carIDNameMap.get(model_data);

//     if (carName != undefined) {
//       var address = peripheral.address;
//       var newCar = new ankiCar(carName, address);
//       newCar.peripheral = peripheral;
//       newCar.connected = false;

//       // test if this car name already exists in the map
//       var mapKeyName = carName;
//       var index = 1;
//       while (ankiCarMap.get(mapKeyName) != undefined) {
//         // car with this name exists in the map already so create a new key name
//         index++;
//         mapKeyName = carName + ' (' + index + ')';
//       }

//       // add this new named car to the map
//       console.log("Added car: " + mapKeyName + " Type: " + carName + " Address: [" + address + "]");
//       ankiCarMap.set(mapKeyName, newCar);
//     }
//   }
// });

// noble.on('disconnect', function (peripheral) {
//   console.log("BTLE: disconnect called");
// });

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
  var sdkMessage = Buffer.alloc(4);
  sdkMessage.writeUInt8(0x03, 0); // Msg Size
  sdkMessage.writeUInt8(ANKI_VEHICLE_MSG_C2V_SDK_MODE, 1);
  sdkMessage.writeUInt8(0x01, 2); // 0 = off / 1 = on
  sdkMessage.writeUInt8(ANKI_VEHICLE_SDK_OPTION_OVERRIDE_LOCALIZATION, 3); // OVERRIDE_LOCALIZATION (needed for other apis)
  writerCharacteristic.write(sdkMessage, false, function (err) { });
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
var setLaneOffset = function (writerCharacteristic, change) {
  offsetMessage = Buffer.alloc(6);
  offsetMessage.writeUInt8(0x05, 0);
  offsetMessage.writeUInt8(ANKI_VEHICLE_MSG_C2V_SET_OFFSET_FROM_ROAD_CENTER, 1);
  offsetMessage.writeFloatLE(parseFloat(change), 2); // Offset value (?? 68,23,-23,68 seem to be lane values 1-4)

  console.log("Sending lane offset: " + change);
  writerCharacteristic.write(offsetMessage, false, function (err) {
    if (err) {
      console.log("Error: " + util.inspect(err, false, null));
    }
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
    console.log("Disconnected from: " + carName);
    ankiCar.readerCharacteristic = null;
    ankiCar.writerCharacteristic = null;
    ankiCar.connected = false;
  });
}

//////////////////////////////////////////////////////////
// Disconnect from all cars
//////////////////////////////////////////////////////////
var disconnectAllCars = function () {
  console.log("Disconnecting from all cars.");

  for (var [carMapName, car] of ankiCarMap.entries()) {
    if (car.connected == true) {
      var peripheral = car.peripheral;
      peripheral.disconnect(function (error) {
        console.log("Disconnected from: " + carMapName);
        car.readerCharacteristic = null;
        car.writerCharacteristic = null;
        car.connected = false;
      });
    }
  }
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
      if (ankiCar.connected == true) {
        // already connected
        resolve();
        return;
      }

      peripheral.connect(function (error) {
        if (error) {
          reject("Unable to connect to: " + carName + " err: " + error);
        } else {
          console.log("Connected to " + ankiCar.name + " : " + peripheral.uuid);
          ankiCar.connected = true;

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
        }
      });
    }
  );
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
        resolve(ankiCar.readerCharacteristic);
        return;
      }

      // If we are here, there was no reader... we need to try and connect.
      connectCar(carName).then(function (res) {
        if (ankiCar.readerCharacteristic != null) {
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
        resolve(ankiCar.writerCharacteristic);
        return;
      }

      // One does not exist, try to create one.
      connectCar(carName).then(function (res) {
        // Try again after connect.
        if (ankiCar.writerCharacteristic != null) {
          resolve(ankiCar.writerCharacteristic);
          return;
        }
      });

      reject("Could not get writer.");
    });
  return (getWriterPromise);
}

// Lights pattern message
// uint8_t    size;
// uint8_t    msg_id;
// uint8_t    channel_count;
// {
//    uint8_t     channel;
//    uint8_t     effect;
//    uint8_t     start;
//    uint8_t     end;
//    uint8_t     cycles_per_10_sec;  
// }

// Set lights pattern
// Game: 0x15 0x00 0x04 0x00 0x52 0x0b 0x00 
//    0x11 0x33 0x03   0x00 0x00 0x00 0x00 0x00   0x03 0x00 0x00 0x00 0x00   0x02 0x00 0x0e 0x0e 0x00   0xfc 0x01 0xa8 // Blue
// Game: 0x15 0x00 0x04 0x00 0x52 0x0b 0x00 
//    0x11 0x33 0x03   0x00 0x00 0x0a 0x0a 0x00   0x03 0x00 0x00 0x00 0x00   0x02 0x00 0x00 0x00 0x00   0x7e 0x8c 0xc2 // Red
// Game: 0x15 0x00 0x04 0x00 0x52 0x0b 0x00 0x11 0x33 0x03 0x00 0x00 0x00 0x00 0x00 0x03 0x00 0x0a 0x0a 0x00 0x02 0x00 0x00 0x00 0x00 0x37 0x9a 0x07 // Green
// Game: 0x15 0x00 0x04 0x00 0x52 0x0b 0x00 0x11 0x33 0x03 0x00 0x00 0x0a 0x0a 0x00 0x03 0x00 0x00 0x00 0x00 0x02 0x00 0x0a 0x0a 0x00 0x68 0xd2 0x79 // Purple

// Brake Lights:(works)
// Game: 0x15 0x00 0x04 0x00 0x52 0x0b 0x00 
//    0x11 0x33 0x01   0x01 0x00 0x0e 0x0e 0x00   0x08 0x00 0x00 0x00 0x81 0x51 0x7d 0x79 0xf4 0xeb 0x5a 0xd8 0xbe

const ANKI_LIGHT_CHANNEL_RED = 0x00;
const ANKI_LIGHT_CHANNEL_TAIL = 0x01;
const ANKI_LIGHT_CHANNEL_BLUE = 0x02;
const ANKI_LIGHT_CHANNEL_GREEN = 0x03;
const ANKI_LIGHT_CHANNEL_FRONTL = 0x04;
const ANKI_LIGHT_CHANNEL_FRONTR = 0x05;
const ANKI_LIGHT_EFFECT_STEADY = 0x00;
const ANKI_LIGHT_EFFECT_FADE = 0x01;
const ANKI_LIGHT_EFFECT_THROB = 0x02;

var setEngineLight = function (carName, red, green, blue) {
  // New API.
  var lightsPatternMessage = Buffer.alloc(18);
  lightsPatternMessage.writeUInt8(0x11, 0);                                   // Buffer Size
  lightsPatternMessage.writeUInt8(ANKI_VEHICLE_MSG_C2V_LIGHTS_PATTERN, 1);
  lightsPatternMessage.writeUInt8(0x03, 2);                                   // channel count 3
  lightsPatternMessage.writeUInt8(ANKI_LIGHT_CHANNEL_RED, 3);
  lightsPatternMessage.writeUInt8(ANKI_LIGHT_EFFECT_STEADY, 4);
  lightsPatternMessage.writeUInt8(red, 5);                                    // Red Start
  lightsPatternMessage.writeUInt8(red, 6);                                    // Red End
  lightsPatternMessage.writeUInt8(0x00, 7);                                   // cycles per 10 sec
  lightsPatternMessage.writeUInt8(ANKI_LIGHT_CHANNEL_GREEN, 8);
  lightsPatternMessage.writeUInt8(ANKI_LIGHT_EFFECT_STEADY, 9);
  lightsPatternMessage.writeUInt8(green, 10);                                 // Green Start
  lightsPatternMessage.writeUInt8(green, 11);                                 // Green End
  lightsPatternMessage.writeUInt8(0x00, 12);                                  // cycles per 10 sec
  lightsPatternMessage.writeUInt8(ANKI_LIGHT_CHANNEL_BLUE, 13);
  lightsPatternMessage.writeUInt8(ANKI_LIGHT_EFFECT_STEADY, 14);
  lightsPatternMessage.writeUInt8(blue, 15);                                  // Blue start
  lightsPatternMessage.writeUInt8(blue, 16);                                  // Blue End
  lightsPatternMessage.writeUInt8(0x00, 17);                                  // cycles per 10 sec

  getWriterCharacteristic(carName).then(function (writerCharacteristic) {
    console.log("Turn on lights");
    writerCharacteristic.write(lightsPatternMessage, false, function (err) {
      if (err) {
        console.log("Error: " + util.inspect(err, false, null));
      }
    });
  });
}

//////////////////////////////////////////////////////////
// Make the car do a U-Turn
//////////////////////////////////////////////////////////
var uTurn = function (carName) {
  var uTurnMessage = Buffer.alloc(4);
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
        }
      });
    }
  });
}

//////////////////////////////////////////////////////////
// Set car speed
//////////////////////////////////////////////////////////
var setSpeed = function (carName, speed) {
  getWriterCharacteristic(carName).then(function (writerCharacteristic) {
    var speedMessage = Buffer.alloc(7);
    speedMessage.writeUInt8(0x06, 0);
    speedMessage.writeUInt8(ANKI_VEHICLE_MSG_C2V_SET_SPEED, 1);
    speedMessage.writeInt16LE(speed, 2);
    speedMessage.writeInt16LE(1000, 4);

    writerCharacteristic.write(speedMessage, false, function (err) {
      if (err) {
        console.log("Error: " + util.inspect(err, false, null));
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

  getWriterCharacteristic(carName).then(function (writerCharacteristic) {
    var changeMessage = Buffer.alloc(12);
    changeMessage.writeUInt8(11, 0); // ANKI_VEHICLE_MSG_C2V_CHANGE_LANE_SIZE
    changeMessage.writeUInt8(ANKI_VEHICLE_MSG_C2V_CHANGE_LANE, 1);
    changeMessage.writeInt16LE(250, 2); // horizontal_speed_mm_per_sec
    changeMessage.writeInt16LE(1000, 4); // horizontal_accel_mm_per_sec2
    changeMessage.writeFloatLE(parseFloat(change), 6); // offset_from_road_center_mm

    console.log("Sending lane change: " + change);
    writerCharacteristic.write(changeMessage, false, function (err) {
      if (err) {
        console.log("Error: " + util.inspect(err, false, null));
      }
    });
  });
}

//////////////////////////////////////////////////////////
// Get Battery Levels
//////////////////////////////////////////////////////////
var batteryLevel = function (carName) {
  getWriterCharacteristic(carName).then(function (writerCharacteristic) {
    var message = Buffer.alloc(2);
    message.writeUInt8(0x01, 0);
    message.writeUInt8(ANKI_VEHICLE_MSG_C2V_BATTERY_LEVEL_REQUEST, 1);

    writerCharacteristic.write(message, false, function (err) {
      if (err) {
        console.log("Error: " + util.inspect(err, false, null));
      }
    });
  });
}

//////////////////////////////////////////////////////////
// Ping / Response
//////////////////////////////////////////////////////////
var ping = function (carName) {
  var message = Buffer.alloc(2);
  message.writeUInt8(0x01, 0);
  message.writeUInt8(ANKI_VEHICLE_MSG_C2V_PING_REQUEST, 1);
  getWriterCharacteristic(carName).then(function (writerCharacteristic) {
    writerCharacteristic.write(message, false, function (err) {
      if (err) {
        console.log("Error: " + util.inspect(err, false, null));
      }
    });
  });
}

//////////////////////////////////////////////////////////
// Audit cars
//////////////////////////////////////////////////////////
var auditCars = function () {
  ankiCarMap.forEach(function (value, key) {
    console.log("Car: " + key + " Data: " + util.inspect(value, false, 1));
  });
}

//////////////////////////////////////////////////////////
// Track Count Travel.  Makes a car travel 'x' number of tracks, then stop.
//////////////////////////////////////////////////////////
var trackCountTravel = function (carName, tracksToTravel, speed) {
  getReaderCharacteristic(carName).then(function (readerCharacteristic) {
    if (readerCharacteristic == null) {
      return ("Unable to find and connect to car " + carName);
    }
    var trackCount = 0;

    async.series(
      [
        function (callback) {
          // start the reader
          console.log("Starting reader...");
          trackCount = 0;
          readerCharacteristic.subscribe();
          callback(null, 0);
        },

        function (callback) { // Write the request to start the car travelling
          console.log("Starting car...");
          trackCount = 0;
          setSpeed(carName, speed);
          callback(null, 0);
        },

        function (callback) {
          function processData(data, isNotification) {
            var messageId = data.readUInt8(1);
            if (messageId == ANKI_VEHICLE_MSG_V2C_LOCALIZATION_TRANSITION_UPDATE) {
              console.log(carName + " [Track Event]: ", data);
              // Track event (This happens when the car transitions from one track to the next)
              trackCount = trackCount + 1;
              console.log("Track Count: " + trackCount + "/" + tracksToTravel);
              if (trackCount >= tracksToTravel) {
                readerCharacteristic.removeListener('data', processData);
                callback(null, trackCount);
              }
            } else if (messageId == ANKI_VEHICLE_MSG_V2C_LOCALIZATION_POSITION_UPDATE) {
              var trackLocation = data.readUInt8(2);
              var trackId = data.readUInt8(3);
              var offset = data.readFloatLE(4);
              var speed = data.readUInt16LE(8);
              var clockwise = false;
              if (data.readUInt8(10) == 0x47) {
                clockwise = true;
              }
              console.log(carName + " TrackId: " + trackId + " TrackLoc: " + trackLocation + " CW: " + clockwise +
                " offset: " + offset + " speed: " + speed);
            }
          }
          readerCharacteristic.on('data', processData);
        }
      ],

      function (err, results) {
        console.log("Final call.  Stop car: " + results);
        trackCount = 0;
        readerCharacteristic.unsubscribe();
        setSpeed(carName, 0);
      }
    );
  });
}

var mapTrack = function (carName, trackMap) {
  console.log("Map Track Start...");
  trackMap.resetTrackMap();
  getReaderCharacteristic(carName).then(function (readerCharacteristic) {
    if (readerCharacteristic == null) {
      return ("Unable to find and connect to car " + carName);
    }
    var replyData = null;
    var trackCount = 0;
    var trackTransition = false;
    var startTrackCount = 0;

    async.parallel([
      function (callback) {  // Turn on reader notifications
        readerCharacteristic.subscribe();
        callback();
      },
      function (callback) { // Read data until we get track msg
        console.log("Starting reader...");
        function processData(data, isNotification) {
          var messageId = data.readUInt8(1);
          if (messageId == ANKI_VEHICLE_MSG_V2C_LOCALIZATION_POSITION_UPDATE) {
            // we have entered a new track section (signalled by the transition event)
            // so use the track ID to record what sort of section this is in the map
            if (trackTransition == true) {
              var trackId = data.readUInt8(3);
              var clockwise = false;
              if (data.readUInt8(10) == 0x47) {
                clockwise = true;
              }

              trackMap.addTrackToMap(trackId, clockwise);

              if (trackId == 33) { // Start track
                startTrackCount++;
                if (startTrackCount >= 2) {
                  // stop the car
                  readerCharacteristic.removeListener('read', processData);
                  callback();
                }
              }
              trackTransition = false;
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
    disconnectAllCars: disconnectAllCars,
    turnOnSdkMode: turnOnSdkMode,
    setLaneOffset: setLaneOffset,
    setEngineLight: setEngineLight,
    setSpeed: setSpeed,
    turnOnLogging: turnOnLogging,
    changeLanes: changeLanes,
    uTurn: uTurn,
    ping: ping,
    auditCars: auditCars,
    batteryLevel: batteryLevel,
    trackCountTravel: trackCountTravel,
    mapTrack: mapTrack,
    getModelName: getModelName
  }
};
