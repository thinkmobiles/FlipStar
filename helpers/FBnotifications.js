var RESPONSES = require('../constants/responseMessages');
var TABLES = require('../constants/tables');
var GROUPS = require('../constants/FbNotificationGroup');
var CONSTANTS = require('../constants/constants');
var async = require('async');
var _ = require('underscore');
var graph = require('fbgraph');
var GameProfHelper = require('../helpers/gameProfile');
var UserProfHelper = require('../helpers/userProfile');
var Users;

FBnotif = function (PostGre) {
    var gameProfHelper = new GameProfHelper(PostGre);
    var userProfHelper = new UserProfHelper(PostGre);


    function createView(callback) {
        PostGre.knex
            .raw('CREATE OR REPLACE VIEW ' + TABLES.FB_NOTIFICATIONS_VIEW + ' ' +
            'AS ( ' +
                    'SELECT facebook_id, group_name ' +
                    'FROM ' +
                    '(SELECT facebook_id , text  \'' + GROUPS.GROUP_B + '\'  as group_name ' +
                    'FROM ' + TABLES.FB_NOTIFICATIONS + '  WHERE is_newbie = false and unresponsive_notification = 0) as TABLE1 ' +
                'UNION ' +
                    '(SELECT facebook_id, text \'' + GROUPS.GROUP_C + '\' as group_name ' +
                    'FROM ' + TABLES.FB_NOTIFICATIONS + '  WHERE is_newbie = false and unresponsive_notification = 1 and  extract(days from (current_timestamp - notification_date)) >= 2) ' +
                'UNION ' +
                    '(SELECT facebook_id, text \'' + GROUPS.GROUP_D + '\' as group_name ' +
                    'FROM ' + TABLES.FB_NOTIFICATIONS + '  WHERE is_newbie = false and unresponsive_notification = 2 and  extract(days from (current_timestamp - notification_date)) > 7) ' +
                'UNION ' +
                    '(SELECT u.facebook_id, text \'' + GROUPS.GROUP_E + '\' as group_name ' +
                    'FROM  ' + TABLES.GAME_PROFILE + ' g LEFT JOIN ' + TABLES.USERS_PROFILE + ' u on g.user_id = u.id ' +
                    'WHERE extract(days from (current_timestamp - g.last_seen_date)) > 28) ' +
                'UNION ' +
                    '(SELECT fb.facebook_id, text \'' + GROUPS.GROUP_A + '\' as group_name ' +
                    'FROM ' + TABLES.FB_NOTIFICATIONS + ' fb LEFT JOIN ' + TABLES.USERS_PROFILE + ' u on fb.facebook_id = u.facebook_id ' +
                    'LEFT JOIN ' + TABLES.GAME_PROFILE + ' g on g.user_id = u.id ' +
                    'where fb.is_newbie = true and extract(days from (current_timestamp - g.last_seen_date)) <= 28) ' +
            ')'
        )
            .exec(function (err) {
                if (err) {
                    return callback(err)
                }
                callback()
            })
    };

    function getLimit(callback) {
        var count;
        var limit;
        var conditionList;
        var valuesList;

        PostGre.knex(TABLES.FB_NOTIFICATIONS_VIEW)
            .count()
            .where('group_name', GROUPS.GROUP_B)
            .exec(function (err, result) {
                if (err) {
                    return callback(err)
                }
                count = result[0].count;

                conditionList = [
                    count <= CONSTANTS.FB_LIMITS.LEVEL_1,
                    count >= CONSTANTS.FB_LIMITS.LEVEL_1 && count < CONSTANTS.FB_LIMITS.LEVEL_2,
                    count >= CONSTANTS.FB_LIMITS.LEVEL_2 && count < CONSTANTS.FB_LIMITS.LEVEL_3,
                    count >= CONSTANTS.FB_LIMITS.LEVEL_3 && count < CONSTANTS.FB_LIMITS.LEVEL_4,
                    count >= CONSTANTS.FB_LIMITS.LEVEL_4 && count < CONSTANTS.FB_LIMITS.LEVEL_5,
                    count >= CONSTANTS.FB_LIMITS.LEVEL_5 && count < CONSTANTS.FB_LIMITS.LEVEL_6,
                    count >= CONSTANTS.FB_LIMITS.LEVEL_6 && count < CONSTANTS.FB_LIMITS.LEVEL_7,
                    count >= CONSTANTS.FB_LIMITS.LEVEL_7 && count < CONSTANTS.FB_LIMITS.LEVEL_8,
                    count >= CONSTANTS.FB_LIMITS.LEVEL_8 && count < CONSTANTS.FB_LIMITS.LEVEL_9,
                    count >= CONSTANTS.FB_LIMITS.LEVEL_9 && count < CONSTANTS.FB_LIMITS.LEVEL_10,
                    count >= CONSTANTS.FB_LIMITS.LEVEL_10 && count < CONSTANTS.FB_LIMITS.LEVEL_11,
                    count >= CONSTANTS.FB_LIMITS.LEVEL_11
                ];
                valuesList = [
                    CONSTANTS.FB_LIMITS.DEFAULT,
                    CONSTANTS.FB_LIMITS.GROWTH_1,
                    CONSTANTS.FB_LIMITS.GROWTH_2,
                    CONSTANTS.FB_LIMITS.GROWTH_3,
                    CONSTANTS.FB_LIMITS.GROWTH_4,
                    CONSTANTS.FB_LIMITS.GROWTH_5,
                    CONSTANTS.FB_LIMITS.GROWTH_6,
                    CONSTANTS.FB_LIMITS.GROWTH_7,
                    CONSTANTS.FB_LIMITS.GROWTH_8,
                    CONSTANTS.FB_LIMITS.GROWTH_9,
                    CONSTANTS.FB_LIMITS.GROWTH_10,
                    CONSTANTS.FB_LIMITS.GROWTH_11
                ];
                limit = valuesList[conditionList.indexOf(true)];
                callback(null, limit);
            })
    };

    this.getUsersGroup = function (callback) {

        createView(function (err) {
            if (err) {
                return callback(err)
            }
            getLimit(function (err, limit) {
                if (err) {
                    return callback(err)
                }
                PostGre.knex(TABLES.FB_NOTIFICATIONS_VIEW)
                    .select()
                    .orderBy('group_name')
                    .limit(limit)
                    .exec(function (err, result) {
                        if(err) {
                            return callback(err)
                        }
                        callback(null, result)
                    })
            })

        })
    };

    this.sendNotification = function (dispatchList, callback) {
        graph.setAccessToken(process.env.ACCESS_TOKEN);
        var data = {};
        var fuid;

        async.eachSeries(dispatchList, function (addressee, cb) {
            fuid = addressee.facebook_id;
            data.href = 'user/fb/' + fuid;
            data.template = CONSTANTS.FB_NOTIFICATION_MESSAGES[addressee.group_name];

            graph.post('/' + fuid + '/notifications', data, function(err, response) {
                console.log(response);
                console.log(fuid);

                PostGre.knex
                    .raw(
                    'UPDATE  fb_notifications f SET unresponsive_notification = unresponsive_notification + 1, ' +
                    'is_newbie = false, notification_date = current_timestamp, updated_at = current_timestamp ' +
                    'where facebook_id = \'' + fuid + '\''
                )
                    .exec(function (err) {
                        if (err) {
                            cb(err)
                        } else {
                            cb()
                        }
                    })
            })


        }, function (err) {
            if (err) {
                return callback(err)
            }
            callback()
        })
    };

};

module.exports = FBnotif;