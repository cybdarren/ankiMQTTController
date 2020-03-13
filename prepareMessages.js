var ankiNodeUtils = require('./ankiUtils.js')();
var trackMap = require('./trackMap.js')();
const fs = require('fs');

module.exports = function() {
    return {
        "doc" : function() {
            var output = "Commands:\n";
            output = output + "s [speed] - Set speed\n";
            output = output + "sl        - Orientate and move to start line\n";
            output = output + "e         - Halt car\n";
            output = output + "b         - Get battery level\n";
            output = output + "u         - Perform a U-turn\n";
            output = output + "o [offset]- Change lane\n";
            output = output + "p         - Ping\n";
            output = output + "l [r g b] - Lights <r,g,b:0-14>\n"
            output = output + "t [tracks]- Travel tracks\n";
            output = output + "m         - Perform track mapping\n";
            output = output + "g [file]  - Export track map to file\n";
            output = output + "gn        - Print map number array\n";
            output = output + "v         - Get software version\n";
            output = output + "q         - Disconnect and quit\n";
            output = output + "r         - Rescan and discover devices\n";
            return output;    
        },

        "invoke": function(command, reader, writer) {
            var cmd;
            var commandArray;
            if (command.indexOf(' ') == -1) {
                cmd = command;
            } else {
                commandArray = command.split(' ');
                if (commandArray.length > 0) {
                    cmd = commandArray[0];
                }
            }

            // set speed
            if (cmd == "s") {
                var speed = 500;

                if (commandArray) {
                    if (commandArray.length > 1) {
                        speed = commandArray[1];
                    }
                }
                ankiNodeUtils.setSpeed(writer, speed);
            }

            // orientate the correct way and move to the start line then stop
            if (cmd == "sl") {
                var speed = 500;
                ankiNodeUtils.onYourMarks(reader, writer, speed);
            }

            // end/set speed 0
            if (cmd == "e") {
                ankiNodeUtils.setSpeed(writer, 0);
            }

            // change lanes
            if (cmd == 'o') {
                var offset = 0.0;

                if (commandArray) {
                    if (commandArray.length > 1) {
                        offset = commandArray[1];
                    }

                }
                ankiNodeUtils.changeLanes(writer, offset);
            }

            // get battery level
            if (cmd == 'b') {
                ankiNodeUtils.batteryLevel(writer);
            }

            // perform a U turn
            if (cmd == 'u') {
                // 0 = immediately, 1 = next track junction
                ankiNodeUtils.uTurn(writer, 0);
            }

            // ping car
            if (cmd == 'p') {
                ankiNodeUtils.ping(writer);
            }

            // lights
            if (cmd == 'l') {
                if (commandArray) {
                    if (commandArray.length == 4) {
                        var r = commandArray[1];
                        var g = commandArray[2];
                        var b = commandArray[3];
                        ankiNodeUtils.setEngineLight(writer, r, g, b);
                    }
                }
            }

            if (cmd == 't') {
                if (commandArray) {
                    if (commandArray.length == 2) {
                        var dist = commandArray[1];
                        ankiNodeUtils.trackCountTravel(reader, writer, dist, 400);
                    }
                }
            }
            
            if (cmd == 'm') {
                ankiNodeUtils.mapTrack(reader, writer, trackMap);

            }

            if (cmd == 'g') {
                if (command) {
                    if (commandArray.length == 2) {
                        var fileName = __dirname + '/' + commandArray[1];
                        var gMap = trackMap.getTrackMapImage("small");
                        var buf = gMap.toBuffer();
                        fs.writeFile(fileName, buf, function(err) {
                            if (err) throw err;
                            console.log("File saved.");
                        });
                    }
                }
            }

            if (cmd == 'gn') {
                var mapData = trackMap.getTrackMapImageNames();
                console.log("Track map image: " + mapData);
            }

            if (cmd == 'v') {
                ankiNodeUtils.version(writer);
            }

            if (cmd == 'q') {
                if (writer)
                    ankiNodeUtils.disconnectCar(writer);
            }

            if (cmd == 'r') {
                // handled in controller.js
            }
            
            return;
        },

        "getMap": function() {
            if (trackMap.isTrackMapDone) {
                return trackMap.getTrackMapImageNames();
            } else {
                return null;
            }
        }
    };
};
