/**
 * Created by migal on 11.08.15.
 */

var Tables = require('../constants/tables');
var RESPONSES = require('../constants/responseMessages');
var PushHandler = require('./notifications');
var _ = require('lodash');
var async = require('async');


var pushQueue = function(app, PostGre){
    var queue = app.get('eventQueue');

    var pusher = new PushHandler(PostGre);

    function canSendMsg(timeString, timeZone){

        var now;
        var timeToMinutes;

        if (typeof timeString === 'number' && timeZone === null) {

            timeZone = timeString;
            now = new Date();

        } else {

            now = new Date(timeString);

        }

        now.setHours((now.getHours() + timeZone) % 24);

        timeToMinutes = now.getHours() * 60 + now.getMinutes();

        return (timeToMinutes <=  21 * 60 && timeToMinutes >= 8 * 60);
    }

    function insertToDB(insertObj, cb){
        PostGre.knex(Tables.NOTIFICATIONS_QUEUE)
            .insert(insertObj)
            .exec(function(err){
                if (err){
                    return cb(err);
                }

                cb(null, true);

            });
    }

    function updateDB(updateOjb, id, cb){
        PostGre.knex(Tables.NOTIFICATIONS_QUEUE)
            .update(updateOjb)
            .where({id: id})
            .exec(function(err){

                if (err){
                    return cb(err);
                }

                cb(null, true);

            });
    }

    function getUsersByCriterion(criterionObj, callback){

        var usersArray;

        PostGre.knex
            .select('id')
            .from(Tables.USERS_PROFILE)
            .where(criterionObj)   // TODO: check criterion
            .exec(function(err, resultUsersId){

                if (err){
                    return callback(err);
                }

                usersArray = _.pluck(resultUsersId, 'id');

                callback(null, usersArray);

            });

    }

    function send(usersArray, message, callback){

        async.each(usersArray, function(user, cb){

            message['userId'] = user;

            queue.sendMessage('push', message, cb);
            
        }, function(err){

            if (err){
                return callback(err);
            }

            callback(null);

        });
    }

    function sendMsgToGroupUsers (message, callback){

        var groupCriterion = message.criterion;

        getUsersByCriterion(groupCriterion, function(err, usersArray){
            if (err){
                return callback(err);
            }

            send(usersArray, message, function(err){

                if (err){
                    return callback(err);
                }

                callback(null);

            })

        });
    }

    function timeDifference (oldTime, newTime){

        return Math.abs((new Date(newTime)).getTime() - (new Date(oldTime)).getTime())

    }

    function sendMsgFromQueue(userId, message, callback){

        var timeZone;
        var timeToSend = message.timeToSend;
        var msg = message.msg;
        var difference;
        var now;
        var gameProfile;
        var priority = message.priority;
        var oldMsg;
        var highPriority;
        var normalPriority;
        var currentId;

        PostGre.knex
            .select('timezone')
            .from(Tables.USERS_PROFILE)
            .where({id: userId})
            .limit(1)
            .exec(function(err, result){

                if(err){
                    return callback(err);
                }

                if(!result && !result.length){
                    err = new Error(RESPONSES.DATABASE_ERROR);
                    err.sttus = 400;
                    return callback(err);
                }

                timeZone = result[0].timezone;

                if (!canSendMsg(timeToSend, timeZone)){
                    return callback(null);
                }

                priority = message.priority;

                PostGre.knex
                    .select('id')
                    .from(Tables.GAME_PROFILE)
                    .where({user_id: userId})
                    .limit(1)
                    .exec(function(err, resultGame){
                        if (err){
                            return callback(err);
                        }

                        if (!resultGame.length){
                            err = new Error(RESPONSES.DATABASE_ERROR);
                            err.status = 400;
                            return callback(err);
                        }

                        gameProfile = resultGame[0].id;

                        PostGre.knex
                            .select()
                            .from(Tables.NOTIFICATIONS_QUEUE)
                            .where({game_profile_id: gameProfile})
                            .exec(function(err, resultPushes){

                                if (err){
                                    return callback(err);
                                }

                               if (!resultPushes.length){

                                   pusher.sendPushNotifications(userId, msg, message, function(err){

                                       if (err){
                                           return callback(err);
                                       }

                                       insertToDB({
                                           game_profile_id: gameProfile,
                                           type: 'push',
                                           priority: priority
                                       }, callback);

                                   });

                               } else if (resultPushes.length === 1){

                                   oldMsg = resultPushes[0];

                                   difference = timeDifference(oldMsg.timeToSend, message.timeToSend);

                                   if (oldMsg.priority === 'high'){
                                       if (message.priority === 'high'){
                                           if (difference < 2 * 60 * 60 * 1000){

                                               return callback(null, null);

                                           } else {

                                               pusher.sendPushNotifications(userId, msg, message, function(err){
                                                   if (err){
                                                       return callback(err);
                                                   }

                                                   now = new Date();

                                                   updateDB({
                                                       timeToSend: now
                                                   }, oldMsg.id, callback)

                                               });

                                           }

                                       } else {

                                          if (difference >=  5 * 60 * 1000){
                                              pusher.sendPushNotifications(userId, msg, message, function(err){
                                                  if (err){
                                                      return callback(err);
                                                  }

                                                  insertToDB({
                                                      game_profile_id: gameProfile,
                                                      type: 'push',
                                                      priority: priority
                                                  }, callback);
                                              });

                                          } else {
                                              setTimeout(function(){
                                                  pusher.sendPushNotifications(userId, msg, message, function(err){
                                                      if (err){
                                                          return callback(err);
                                                      }

                                                      insertToDB({
                                                          game_profile_id: gameProfile,
                                                          type: 'push',
                                                          priority: priority
                                                      }, callback);
                                                  });
                                              }, 5 * 60 * 1000 - difference);
                                          }
                                       }

                                   } else {
                                       if (message.priority === 'normal'){
                                           if (difference < 2 * 60 * 60 * 1000){

                                               return callback(null, null);

                                           } else {

                                               pusher.sendPushNotifications(userId, msg, message, function(err){

                                                   if (err){
                                                       return callback(err);
                                                   }

                                                   updateDB({
                                                       timeToSend: new Date()
                                                   }, oldMsg.id, callback);

                                               });

                                           }

                                       } else {

                                           pusher.sendPushNotifications(userId, msg, message, function(err){

                                               if (err){
                                                   return callback(err);
                                               }

                                               insertToDB({
                                                   game_profile_id: gameProfile,
                                                   type: 'push',
                                                   priority: priority
                                               }, callback);

                                           });

                                       }
                                   }
                               } else {

                                   highPriority = _.result(_.findWhere(resultPushes, {priority: 'high'}));

                                   normalPriority = _.result(_.findWhere(resultPushes, {priority: 'normal'}));

                                   if (message.priority === 'high') {

                                       difference = timeDifference(message.timeToSend, highPriority.timeToSend);
                                       currentId = highPriority.id;

                                   } else {

                                       difference = timeDifference(message.timeToSend, normalPriority.timeToSend);
                                       currentId = normalPriority.id;

                                   }

                                   if (difference < 2 * 60 * 60 * 1000) {
                                       callback(null, null);
                                   } else {

                                       pusher.sendPushNotifications(userId, msg, message, function () {

                                           if (err) {
                                               return callback(err);
                                           }

                                           updateDB({
                                               timeToSend: new Date()
                                           }, currentId, callback);

                                       });

                                   }


                               }

                            });

                    })

            });

    }

    return {
        sendMsgFromQueue: sendMsgFromQueue,
        sendMsgToGroupUsers: sendMsgToGroupUsers
    };


};

module.exports = pushQueue;