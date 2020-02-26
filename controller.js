const ankiNodeUtils = require('./ankiUtils.js')();
const config = require('./config-wrapper.js')();
const prepareMessages = require('./prepareMessages.js')();
const readline = require('readline');
const mqtt = require('mqtt');




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
    prepareMessages.format(cmd);
  }

  cli.prompt();
});

process.stdin.resume();

function exitHandler(option, err) {
  // disconnect from all the cars
  ankiNodeUtils.disconnectAllCars();
}

process.on('exit', exitHandler.bind(null, { cleanup: true }));
process.on('SIGINT', exitHandler.bind(null, { exit: true }));
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
