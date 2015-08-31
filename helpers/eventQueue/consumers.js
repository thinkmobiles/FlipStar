/**
 * Created by eriy on 07.08.15.
 */


var TABLES = require('../../constants/tables');
var RESPONSES = require('../../constants/responseMessages');
var MODELS = require('../../constants/models');
//var fbPushHelper = require('../FBnotifications');
var logger = require('../logger');


module.exports = function(app, PostGre){
    var pushQueue = require('../pushQueue')(app, PostGre);
    //var fbPusher = new fbPushHelper(PostGre);

    var NotificationsHistoryModel = PostGre.Models[MODELS.NOTIFICATIONS_HISTORY];

    function saveOrUpdateNotificatioHistory (gameId, message, callback) {

        var now = new Date();
        var notificationHistory;
        var saveObj;

        notificationHistory = new NotificationsHistoryModel({'game_profile_id': gameId});

        saveObj = {
            'game_profile_id': gameId,
            'type': message.type,
            'priority': message.priority,
            'delivery_date': now
        };

        notificationHistory
            .fetch()
            .then(function (resultModel) {

                if (!resultModel) {
                    notificationHistory
                        .save(saveObj)
                        .then(function () {
                            console.log({success: RESPONSES.SAVED});
                        })
                        .otherwise(callback);
                } else {
                    resultModel
                        .save({
                            'type': message.type,
                            'priority': message.priority,
                            'delivery_date': now
                        }, {patch: true})
                        .then(function () {
                            console.log({success: RESPONSES.SAVED});
                        })
                        .otherwise(callback);
                }

            });

    }

    var pushConsumer = {

        topic: 'push',

        callback: function (message) {

            var userId = message.userId;
            var gameId;
            var msgObj = {
                msg: message.msg,
                priority: message.priority,
                timeToSend: message.timeToSend
            };

            pushQueue.sendMsgFromQueue(userId, msgObj, function(err, isSent){
                if (err){
                    return logger.error(err);
                }

                if (!isSent){
                    return;
                }

                PostGre.knex
                    .select('id')
                    .from(TABLES.GAME_PROFILE)
                    .where({'user_id': userId})
                    .limit(1)
                    .exec(function (err, resultRow) {
                        if (err) {
                            return console.log(err)
                        }

                        if (!resultRow.length) {
                            err = new Error(RESPONSES.DATABASE_ERROR);
                            err.status = 400;
                            return console.log(err);
                        }

                        gameId = resultRow[0];

                        saveOrUpdateNotificatioHistory(gameId, message, function(err){
                           logger.error(err);
                        });

                    });

            });

            //console.log(' Consumer Event: ', message);

        }

    };

    var fbPushConsumer = {

        topic: 'fbPush',

        callback: function(message){
            /*fbPusher.sendNotification(message.value.msg, function(){
                console.log('Sent ok!');
            });*/
            console.log(' Consumer Event: ', message);
        }
    };

    var profileConsumer = {

        topic: 'profile',

        callback: function (message) {

            console.log(' Consumer Event: ', message);

        }

    };

    var gameConsumer = {

        topic: 'game',

        callback: function (message) {
            console.log(' Consumer Event: ', message);
        }

    };

    var groupPushConsumer = {

        topic: 'groupPush',

        callback: function(message){

            pushQueue.sendMsgToGroupUsers(message, function(err){

                if (err){
                    return logger.error(err);
                }

                console.log({success: 'message sent to users group'});

            });

        }

    };

    return {
        push: pushConsumer,
        fbPush: fbPushConsumer,
        profile: profileConsumer,
        game: gameConsumer,
        groupPush: groupPushConsumer
    }
};
