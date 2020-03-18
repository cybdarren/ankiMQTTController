/*
 * Copyright (C) 2020 Microchip Technology Inc.  All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

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

// mapping of the start finish straight location ids to offsets
const sfLocationToLaneOffset = [
  -72.5, -72.5,           // locationID 0, 1
  -63.4, -63.4,           // locationID 2, 3
  -54.4, -54.4,           // locationID 4, 5
  -45.3, -45.3,           // locationID 6, 7
  -36.3, -36.3,           // locationID 8, 9
  -27.2, -27.2,           // locationID 10, 11
  -18.1, -18.1,           // locationID 12, 13
   -9.0,  -9.0,           // locationID 14, 15
    0.0,   0.0,           // locationID 16, 17
    9.0,   9.0,           // locationID 18, 19
   18.1,  18.1,           // locationID 20, 21
   27.2,  27.2,           // locationID 22, 23
   36.3,  36.3,           // locationID 24, 25
   45.3,  45.3,           // locationID 26, 27
   54.4,  54.4,           // locationID 28, 29
   63.4,  63.4,           // locationID 30, 31 
];

module.exports = function () {
  return {
    "parse": function (carName, carId, ankiCarLane, data, mqttClient) {

      var msgId = data.readUInt8(1);
      var date = new Date();

      if (msgId == ANKI_VEHICLE_MSG_V2C_PING_RESPONSE) {
        console.log(carName + ": [Ping Response]");

        if (mqttClient) {
          mqttClient.publish('microchip/anki/car/' + carId + '/status/connection',
            'connected'
          , function() {
          });
        }
      }

      else if (msgId == ANKI_VEHICLE_MSG_V2C_VERSION_RESPONSE) {
        var version = data.readUInt16LE(2);
        console.log(carName + ": [Version]: " + version.toString(16));

        if (mqttClient) {
          mqttClient.publish('microchip/anki/car/' + carId + '/status/version', version.toString(16), 
          function() {
          });
        }
      }

      else if (msgId == ANKI_VEHICLE_MSG_V2C_BATTERY_LEVEL_RESPONSE) { 
        var level = data.readUInt16LE(2);
        const MAX_BATTERY_LEVEL = 4200 // This is assumed from experience.
        console.log(carName + " Message[0x" + msgId.toString(16) + "][Battery Level]: " + Math.floor((level / MAX_BATTERY_LEVEL) * 100) + "%");
 
        if (mqttClient) {
          mqttClient.publish('microchip/anki/car/' + carId + '/status/battery', 
            level.toString(),
          function() {
          });
        }
      }

      else if (msgId == ANKI_VEHICLE_MSG_V2C_LOCALIZATION_POSITION_UPDATE) { 
        var trackLocation = data.readUInt8(2);
        var trackId = data.readUInt8(3);
        var offset = data.readFloatLE(4);
        var speed = data.readUInt16LE(8);
        var clockwise = false;
        if (data.readUInt8(10) == 0x47) {
          clockwise = true;
        }

        // if this is the start/finish straight then update the vehicle offset
        if (trackId == 34) {
          var laneOffset = sfLocationToLaneOffset[trackLocation];
          console.log("Lane: " + trackLocation + "  Track offset: " + laneOffset);
        }

        //console.log(carName + " TrackId: " + trackId + " TrackLoc: " + trackLocation + " CW: " + clockwise);
        if (mqttClient) {
          var locObj = new Object();
          locObj.speed = speed;
          locObj.offset = offset;
          locObj.trackId = trackId;
          locObj.trackLoc = trackLocation;
          locObj.clockwise = clockwise;

          mqttClient.publish('microchip/anki/car/' + carId + '/status/speed', 
            speed.toString(), function() {
          });

          mqttClient.publish('microchip/anki/car/' + carId + '/location',
            JSON.stringify(locObj), function() {
          });

        }
      }

      // Message[0x29][Track Event]:  <Buffer 12 29 00 00 10 bf 1f 49 00 ff ff 00 00 54 01 00 00 37 36>
      // It looks like this event has changed from the SDK.  After much trial/error, I found an interesting bit of info from the message to help me figure out the shape of the track.
      else if (msgId == ANKI_VEHICLE_MSG_V2C_LOCALIZATION_TRANSITION_UPDATE) {
        if (data.length < 18) {
          return; // Sometimes we get an odd msg.
        }
        trackTransition = true;
        var leftWheelDistance = data.readUInt8(16);
        var rightWheelDistance = data.readUInt8(17);
        trackStyle = ""
        var absDist = Math.abs(leftWheelDistance - rightWheelDistance);
        if (absDist < 3) {
          trackStyle = "Straight";
        } else if (leftWheelDistance < rightWheelDistance) {
          trackStyle = "Left Turn";
        } else if (leftWheelDistance > rightWheelDistance) {
          trackStyle = "Right Turn";
        }

        // There is a shorter segment for the starting line track.
        crossedStartingLine = "";
        if ((leftWheelDistance < 0x25) && (leftWheelDistance > 0x19) && (rightWheelDistance < 0x25) && (rightWheelDistance > 0x19)) {
          crossedStartingLine = " (Crossed Starting Line)";
        }

        //console.log(carName + " Message[0x" + msgId.toString(16) + "] Left/Right Wheel Distances: " + leftWheelDistance + "/" + rightWheelDistance + " " + trackStyle + crossedStartingLine);
        if (mqttClient) {
          // mqttClient.publish('microchip/anki/car/' + carId + '/evt/fmt/json', JSON.stringify({
          //   'd' : {
          //     'description' : 'Localization Transition Update received',
          //     'date' : date,
          //     'trackStyle' : trackStyle
          //   }
          // }), function() {
          // });
        }
      
      }

      else if (msgId == ANKI_VEHICLE_MSG_V2C_VEHICLE_DELOCALIZED) { 
        console.log(carName + ": [Vehicle Delocalized]: ");

        if (mqttClient) {
          var locObj = new Object();
          locObj.speed = 0;
          locObj.offset = 0;
          locObj.trackId = 0;
          locObj.trackLoc = 0;
          locObj.clockwise = true;

          mqttClient.publish('microchip/anki/car/' + carId + '/status/speed', 
            '0', function() {
          });

          mqttClient.publish('microchip/anki/car/' + carId + '/location',
            JSON.stringify(locObj), function() {
          });
        }
      }

      else if (msgId == ANKI_VEHICLE_MSG_V2C_OFFSET_FROM_ROAD_CENTER_UPDATE) { 
        var offset = data.readFloatLE(2);

        console.log(carName + " Message[0x" + msgId.toString(16) + "][Offset From Road Center Update]: ", data);

        if (mqttClient) {
          mqttClient.publish('microchip/anki/car/' + carId + '/evt/fmt/json', JSON.stringify({
            'd' : {
              'description' : 'Offset update received',
              'date' : date,
              'offset' : offset
            }
          }), function() {
          });
        }
      }

      else {
        // Stop printing unknown messages
        // console.log("Message[0x" + msgId.toString(16) + "][???]: ", data);
      }
    }
  };
};
