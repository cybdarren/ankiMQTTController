var ankiNodeUtils = require('./ankiUtils.js')();
var prepareMessages = require('./prepareMessages.js')();
const readline = require('readline');

global.gCurrentCar = "";

const cli = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
cli.setPrompt('> ');
cli.prompt();

cli.on('line', function (cmd) {
  if (cmd == "help") {
    console.log(prepareMessages.doc());
  //   ankiNodeUtils.connectCar("E4:47:0B:03:97:F0");
  //   //ankiNodeUtils.connectCar("c6:e3:f1:4f:06:17");
  } else {
    prepareMessages.format(cmd);
  }

  cli.prompt();
});

process.stdin.resume();

function exitHandler(option, err) {
  // disconnect from all the cars
}

//process.on('exit', exitHandler.bind(null, { cleanup: true }));
//process.on('SIGINT', exitHandler.bind(null, { exit: true }));
//process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
