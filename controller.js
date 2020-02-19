var ankiNodeUtils = require('./ankiUtils.js')();
var readline = require('readline');

var cli = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  cli.on('line', function (cmd) {
    if (cmd == "help") {
      //console.log(prepareMessages.doc());
      ankiNodeUtils.connectCar("E4:47:0B:03:97:F0");
      ankiNodeUtils.connectCar("c6:e3:f1:4f:06:17");
    } 
    else {
      //invokeCommand(cmd);
    }                        
  });
  
  process.stdin.resume();
