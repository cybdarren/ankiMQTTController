const properties = require('properties');

function connectMQTT(deviceId, apiKey, apiToken, mqttHost, mqttPort, carName, carId, startLane, callback) {

    callback(carName, carId, startLane, null);
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
                    start(cfg.deviceid, cfg.apikey, cfg.authtoken, '127.0.0.1', '1883', 
                        cfg.carname, cfg.carid, cfg.startlane, callback);
                } else {
                    // run the car directly without the mqtt server
                    callback(cfg.carname, cfg.carid, cfg.startlane, null);
                }
            });
        }
    };
};
