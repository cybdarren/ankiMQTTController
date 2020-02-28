const properties = require('properties');
const mqtt = require('mqtt');

function connectMQTT(deviceId, username, password, mqttHost, mqttPort, carName, carId, startLane, callback) {
    var mqttClient = mqtt.connect("mqtt://" + mqttHost + ":" + mqttPort, {
        "keepalive": 30,
        "username": username,
        "password": password
    });

    mqttClient.on('connect', function () {
        var topicName = 'microchip/anki/car/' + carId + '/cmd/fmt/json';
        mqttClient.subscribe(topicName, { qos: 0 }, function (err, granted) {
            if (err) {
                mqttClient = null;
            } else {
                console.log('mqtt client connected');
            }
        });
        console.log("mqtt client connected");
    });

    callback(carName, carId, startLane, mqttClient);
}


module.exports = function () {
    return {
        "read": function (propertiesFileName, callback) {
            if (!propertiesFileName) {
                propertiesFileName = 'config.properties';
                console.error('Using default config.properties file');
            }

            properties.parse('./' + propertiesFileName, { path: true }, function (err, cfg) {
                if (err) {
                    console.error('Error parsing the config file');
                    process.exit(0);
                }

                if (!cfg.carid) {
                    console.error('Error parsing the config file');
                    process.exit(0);
                }

                // convert the MAC ID into a lowercase format without : or -
                var MACString = cfg.carid;
                if (MACString.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/)) {
                    MACString = MACString.split(':').join('');
                    MACString = MACString.split('-').join('');
                    cfg.carid = MACString;
                }
                // convert to lowercase
                cfg.carid = cfg.carid.toLowerCase();
                // remove all whitespace
                cfg.carid = cfg.carid.replace(/\s/g, '');

                if (!cfg.carname) {
                    cfg.carname = "";
                }

                if (cfg.deviceid) {
                    // connect to the mqtt server
                    connectMQTT(cfg.deviceid, cfg.username, cfg.password, cfg.mqttHost, cfg.mqttPort,
                        cfg.carname, cfg.carid, cfg.startlane, callback);
                } else {
                    // run the car directly without the mqtt server
                    callback(cfg.carname, cfg.carid, cfg.startlane, null);
                }
            });
        }
    };
};
