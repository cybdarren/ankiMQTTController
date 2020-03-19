![Guardian Anki car](images/car_pics/Guardian.png)

# ankiMQTTController

This project is designed as a gateway controller between either a linux console terminal, Anki Overdrive Bluetooth cars and a MQTT broker. It will run as a background process on a Linux host or can be controlled using the CLI.

## Basic architecture

The program is written to use the nodejs envrionment allowing it to work efficiently on a simple MPU. Each instance of the program is configured using a configuration file that defines the connection to a specific Anki vehicle (vehicles are uniquely identifed by their MACID). If you want to control more than one vehicle then start multiple instances of the program. The number of cars that can be controlled is limited by the Bluetooth adapter.
At startup the application will attempt to connect to the car with the specified MACID, once connected the user is presented with a command line interface and is able to control the car. As part of the connection process the application can connect as a client to an MQTT broker. Data from the car is published to the broker and the application subscribes to commands coming from the broker.
Commands sent from the CLI can be used to perform a variety of functions with the car such as changing it's speed, moving it left and right across the track, stopping it and automatically generate a map of the track. The same set of commands are also available 
Simultaneously to the control operations, data from the car is recorded and output on to the screen as well as being published to an MQTT broker. A mirror of the CLI commands are also accepted from the MQTT broker using a single subscription. 


### Configuring the Bluetooth adapter for non root (non sudo access)
By default, access to a Bluetooth adapter is restricted to root/sudo access. This prevents a nodejs based application from accessing the adapter directly. The error messages are usually quite vague or you get none at all unless you enable DEBUG for nodejs:

```
DEBUG=hci node controller.js config-guardian.properties
```
You will likely see error messages in the debug log like:
```
  hci set scan enabled - writing: 010c20020001 +0ms
  hci onSocketError: EPERM, Operation not permitted +0ms
  hci set scan parameters - writing: 010b200701100010000000 +1ms
  hci onSocketError: EPERM, Operation not permitted +0ms
  hci onSocketData: 040e0a010910001571da7d1a00 +0ms
```
If this is the case then you will want to change the capabilities of the node application using this command:
```
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
```
[You should of course be sure that this will not open your system to other malicious nodejs applications that might try various attacks on Bluetooth or network stacks]

## License

This program has been altered significantly from the original work found on https://github.com/IBM-Cloud/node-mqtt-for-anki-overdrive and https://github.com/gravesjohnr/AnkiNodeDrive however their contribution and works are acknowledged.