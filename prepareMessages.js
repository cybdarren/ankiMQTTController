var ankiNodeUtils = require('./ankiUtils.js')();
var trackMap = require('./trackMap.js')();
const fs = require('fs');

module.exports = function() {
    return {
        "doc" : function() {
            var output = "Commands:\n";
            output = output + "c carName - Connect to car\n";
            output = output + "s [speed] - Set speed\n";
            output = output + "e         - Halt car\n";
            output = output + "b         - Get battery level\n";
            output = output + "u         - Perform a U-turn\n";
            output = output + "i         - Switch on monitoring for a car\n";
            output = output + "o [offset]- Change lane\n";
            output = output + "p         - Ping\n";
            output = output + "l [r g b] - Lights <r,g,b:0-14>\n"
            output = output + "t [tracks]- Travel tracks\n";
            output = output + "a         - Audit (list) cars\n";
            output = output + "m         - Perform track mapping\n";
            output = output + "g [file]  - Export track map to file\n";
            return output;    
        },

        "format": function(command) {
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
                ankiNodeUtils.setSpeed(gCurrentCar, speed);
            }

            // end/set speed 0
            if (cmd == "e") {
                ankiNodeUtils.setSpeed(gCurrentCar, 0);
            }

            // connect to a vehicle
            if (cmd == 'c') {
                if (commandArray) {
                    if (commandArray.length > 1) {
                        // carName is the remainder of the line, match everything after the command
                        let regexp = /c\s+(.+)/;
                        var result = command.match(regexp);
                        var carName = result[1];
                        ankiNodeUtils.connectCar(carName).then(function (err) {
                            if (err) {
                                console.log("Unable to connect to vehicle.");
                            } else {
                                // update the current car
                                gCurrentCar = carName;    
                            }                       
                        })
                        .catch(function(err) {
                            console.log('error: ', err);
                        });
                    }
                }
            }

            // change lanes
            if (cmd == 'o') {
                var offset = 0.0;

                if (commandArray) {
                    if (commandArray.length > 1) {
                        offset = commandArray[1];
                    }

                }
                ankiNodeUtils.changeLanes(gCurrentCar, offset);
            }

            // get battery level
            if (cmd == 'b') {
                ankiNodeUtils.batteryLevel(gCurrentCar);
            }

            // perform a U turn
            if (cmd == 'u') {
                ankiNodeUtils.uTurn(gCurrentCar);
            }

            // turn on logging for a car
            if (cmd == 'i') {
                ankiNodeUtils.turnOnLogging(gCurrentCar);
            }

            // ping car
            if (cmd == 'p') {
                ankiNodeUtils.ping(gCurrentCar);
            }

            // lights
            if (cmd == 'l') {
                if (commandArray) {
                    if (commandArray.length == 4) {
                        var r = commandArray[1];
                        var g = commandArray[2];
                        var b = commandArray[3];
                        ankiNodeUtils.setEngineLight(gCurrentCar, r, g, b);
                    }
                }
            }

            if (cmd == 't') {
                if (commandArray) {
                    if (commandArray.length == 2) {
                        var dist = commandArray[1];
                        ankiNodeUtils.trackCountTravel(gCurrentCar, dist, 400);
                    }
                }
            }

            if (cmd == 'a') {
                ankiNodeUtils.auditCars();
            }
            
            if (cmd == 'm') {
                ankiNodeUtils.mapTrack(gCurrentCar, trackMap);

            }

            if (cmd == 'g') {
                if (command) {
                    if (commandArray.length == 2) {
                        var fileName = __dirname + '/' + commandArray[1];
                        var gMap = trackMap.getTrackMap("small");
                        var buf = gMap.toBuffer();
                        fs.writeFile(fileName, buf, function(err) {
                            if (err) throw err;
                            console.log("File saved.");
                        });
                    }
                }
            }
            return;
        }
    };
};
