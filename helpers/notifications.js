/**
 * Created by migal on 03.08.15.
 */

var path = require('path');
//var applePusher = require('./apns')();
//var googlePusher = require('./gcm')();

var TABLES = require('../constants/tables');
var async = require('async');
var RESPONSES = require('../constants/responseMessages');

Notifications = function(PostGre){

    this.sendPushNotifications = function(userId, msg, options, callback){

        var sendPushToProvider;

        var pushOptions = {};

        if (typeof options === 'function'){
            callback = options;
            options = {};
        }

        if (typeof options !== 'object' && options !== null){
            options = {};
        }

        pushOptions.payloads = options;

        PostGre.knex
            .select('push_token', 'push_operator')
            .from(TABLES.DEVICE)
            .where({'user_id': userId})
            .exec(function(err, resultPushTokens){

                if (err){
                    return callback(err);
                }

                if (!resultPushTokens.length){
                    err = new Error(RESPONSES.DATABASE_ERROR);
                    err.status = 400;
                    return callback(err);
                }

                async.each(resultPushTokens, function(push, cb){

                    switch (push.push_operator){

                        case 'APPLE': {
                            sendPushToProvider = applePusher;
                        }
                            break;

                        case 'GOOGLE': {
                            sendPushToProvider = googlePusher;
                        }
                            break;

                        default: {
                            err = new Error('Provider '+ push.push_operator + RESPONSES.NOT_IMPLEMENTED);
                            err.status = 400;
                            return cb(err);
                        }
                            break;

                    }

                    sendPushToProvider.sendPush(push.push_token, msg, pushOptions);

                    cb(null);

                }, function(err){

                    if (err){
                        return callback(err);
                    }

                    callback(null);

                });

            });
    }

};

module.exports = Notifications;