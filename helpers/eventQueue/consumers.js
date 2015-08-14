/**
 * Created by eriy on 07.08.15.
 */


var TABLES = require('../../constants/tables');
var RESPONSES = require('../../constants/responseMessages');
var MODELS = require('../../constants/models');
var PushHandler = require('../notifications');
var fbPushHelper = require('../FBnotifications');

module.exports = function(PostGre){
    var pusher = new PushHandler(PostGre);
    var fbPusher = new fbPushHelper(PostGre);

    var NotificationsHistoryModel = PostGre.Models[MODELS.NOTIFICATIONS_HISTORY];

    var pushConsumer = {

        topic: 'push',

        callback: function (message) {

            var userId = message.userId;
            var gameId;
            var notificationHistory;
            var saveObj;
            var now;

            pusher.sendPushNotifications(userId, message.msg, message.option, function (err) {
                if (err) {
                    return console.log(err);
                }

                now = new Date();

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
                                        });
                                } else {
                                    resultModel
                                        .save({
                                            'type': message.type,
                                            'priority': message.priority,
                                            'delivery_date': now
                                        }, {patch: true})
                                        .then(function () {
                                            console.log({success: RESPONSES.SAVED});
                                        });
                                }

                            });
                    });

            });


        }

    };

    var fbPushConsumer = {

        topic: 'fbPush',

        callback: function(message){
            fbPusher.sendNotification(message.msg, function(){});
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

    return {
        push: pushConsumer,
        fbPush: fbPushConsumer,
        profile: profileConsumer,
        game: gameConsumer
    }
};
