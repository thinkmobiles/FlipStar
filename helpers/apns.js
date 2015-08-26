module.exports = (function () {
    "use strict";
    var apn = require("apn");

    var apnsClass = function( certificateUrl ){
        var options = {
            production: true, //todo change
            /*config/KeyFile.p12*/
            pfx: certificateUrl
        };

        var feedback = new apn.Feedback({
            address: "feedback.push.apple.com",
            pfx: certificateUrl,
            "batchFeedback": true,
            "interval": 300
        });

        feedback.start();
        feedback.on('feedback', handleFeedback);
        feedback.on('feedbackError', console.error);

        function handleFeedback(feedbackData) {
            var time;
            var device;

            for (var i in feedbackData) {
                time = feedbackData[i].time;
                device = feedbackData[i].device;

                console.log("Device: " + device.toString('hex') + " has been unreachable, since: " + time);
            }
        }

        var apnConnection = new apn.Connection(options);

        apnConnection.on('connected', function () {
            console.log("Connected");
        });

        apnConnection.on('transmitted', function (notification, device) {
            console.log("Notification transmitted to:" + device.token.toString('hex'));
        });

        apnConnection.on('transmissionError', function (errCode, notification, device) {
            console.error("Notification caused error: " + errCode + " for device ", device, notification);
            if (errCode == 8) {
                console.log("A error code of 8 indicates that the device token is invalid. This could be for a number of reasons - are you using the correct environment? i.e. Production vs. Sandbox");
            }
        });

        apnConnection.on('timeout', function () {
            console.log("Connection Timeout");
        });

        apnConnection.on('disconnected', function () {
            console.log("Disconnected from APNS");
        });

        apnConnection.on('socketError', console.error);

        function sendPush(deviceId, msg, options) {
            if (typeof deviceId === "string") {
                //option must be an dictionary for apn.playload
                var device = new apn.Device(deviceId);
                var note = new apn.Notification();

                note.alert = msg;

                if (options){

                    if(options.expirationDate){
                        note.expiry = options.expirationDate;
                    }

                    if (options.payload && typeof options.payload === 'object') {
                        note.payload = {};
                        Object.keys(options.payload).forEach(function (key) {
                            note.payload[key] = options.payload[key];
                        });
                    }

                    if (options.badge) {
                        note.badge = options.badge;
                    }

                    if (options.sound) {
                        note.sound = options.sound + '.caf';
                    }

                }

                console.dir(note);

                this.pushNotification(note, device);
                return true;
            } else {
                return false;
            }
        }

        apnConnection.sendPush = sendPush;
        return apnConnection;
    };

    return apnsClass;

})();