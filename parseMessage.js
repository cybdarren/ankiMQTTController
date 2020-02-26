var trackMap = require('./trackMap.js')();

var trackTransition = false;

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

module.exports = function () {
  return {
    "parse": function (carName, data) {

      var msgId = data.readUInt8(1);

      if (msgId == ANKI_VEHICLE_MSG_V2C_PING_RESPONSE) {
        console.log(carName + " Message[0x" + msgId.toString(16) + "][Ping Response]: ", data);
      }

      else if (msgId == ANKI_VEHICLE_MSG_V2C_VERSION_RESPONSE) {
        var version = data.readUInt16LE(2);
        console.log(carName + " Message[" + msgId.toString(16) + "][Version]: " + version.toString(16));
      }

      else if (msgId == ANKI_VEHICLE_MSG_V2C_BATTERY_LEVEL_RESPONSE) { 
        var level = data.readUInt16LE(2);
        const MAX_BATTERY_LEVEL = 4200 // This is assumed from experience.
        console.log(carName + " Message[0x" + msgId.toString(16) + "][Battery Level]: " + Math.floor((level / MAX_BATTERY_LEVEL) * 100) + "%");
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
        console.log(carName + " TrackId: " + trackId + " TrackLoc: " + trackLocation + " CW: " + clockwise);
      }

      // Message[0x29][Track Event]:  <Buffer 12 29 00 00 10 bf 1f 49 00 ff ff 00 00 54 01 00 00 37 36>
      // It looks like this event has changed from the SDK.  After much trial/error, I found an interesting bit of info from the message to help me figure out the shape of the track.
      else if (msgId == ANKI_VEHICLE_MSG_V2C_LOCALIZATION_TRANSITION_UPDATE) {
        //console.log("Message[0x"+msgId.toString(16)+"][Track Event]: ",data);
        //console.log("Size: "+data.length);
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

        console.log(carName + " Message[0x" + msgId.toString(16) + "][Track Event]: ", data, "Left/Right Wheel Distances: " + leftWheelDistance + "/" + rightWheelDistance + " " + trackStyle + crossedStartingLine);
      }

      else if (msgId == ANKI_VEHICLE_MSG_V2C_VEHICLE_DELOCALIZED) { 
        console.log(carName + " Message[0x" + msgId.toString(16) + "][Vehicle Delocalized]: ", data);
      }

      else if (msgId == ANKI_VEHICLE_MSG_V2C_OFFSET_FROM_ROAD_CENTER_UPDATE) { 
        console.log(carName + " Message[0x" + msgId.toString(16) + "][Offset From Road Center Update]: ", data);
      }

      else {
        // Stop printing unknown messages
        // console.log("Message[0x" + msgId.toString(16) + "][???]: ", data);
      }
    }
  };
};
