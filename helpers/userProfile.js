var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
var RESPONSES = require('../constants/responseMessages');
var CONSTANTS = require('../constants/constants');
var async = require('async');
var _ = require('lodash');
var Session = require('../handlers/sessions');
var GameProfHelper = require('../helpers/gameProfile');
var Users;

UserProfile = function (PostGre) {
    var UserModel = PostGre.Models[MODELS.USERS_PROFILE];
    var DeviceModel = PostGre.Models[MODELS.DEVICE];
    var GameProfileModel = PostGre.Models[MODELS.GAME_PROFILE];
    var gameProfHelper = new GameProfHelper(PostGre);

    function getWeekNumber () {
        var curDate = new Date();
        var curTime = curDate.getTime();
        var curYearStart = (new Date(curDate.getFullYear(), 0, 1)).getTime();
        var curYearStartDay = (new Date(curDate.getFullYear(), 0, 1)).getDay();
        var hourInMillisecs = 3600000;
        var hoursInOneWeek = 168;
        var weekNumber;

        weekNumber = parseInt((curTime - curYearStart)/hourInMillisecs/hoursInOneWeek);

        if (curYearStartDay >= 4) {
            weekNumber += 2;
        } else {
            weekNumber += 1;
        }
        return weekNumber;
    }

    function getCurrentAge(date) {
        return ((new Date().getTime() - new Date(date)) / (24 * 3600 * 365.25 * 1000)) | 0;
    }

    function prepareSaveInfo (type, options) {
        var newInfo;
        var err;

        if (typeof prepareSaveInfo[type] !== 'function') {
            err = new Error(typeof type + ' doesn\'t exist');
            throw err;
        }

        newInfo = new prepareSaveInfo[type](options);

        return newInfo;
    }

    prepareSaveInfo.device = function (options) {
        var device = {};
        var value = [
            'device_id',
            'device_type',
            'device_timezone',
            'push_token',
            'push_operator',
            'content_version',
            'screen_width',
            'screen_height',
            'device_model',
            'device_manufacturer'
        ];

        for (var i = value.length; i--;){

            if (options['push_operator']) {
                device['device_firmware'] = options['push_operator']
            }
            device[value[i]] = options[value[i]]? options[value[i]] : null
        }

        return device;
    };

    prepareSaveInfo.user = function (options) {
        var user = {};
        var value = [
            'facebook_id',
            'first_name',
            'last_name',
            'gender',
            'email',
            'language_id',
            'country_id',
            'birthday',
            'timezone',
            'phone_number'
        ];

        for (var i = value.length; i--;){

            if (options['birthday']) {
                user['age_range'] = getCurrentAge(value)
            }
            user[value[i]] = options[value[i]]? options[value[i]] : null
        }

        return user;
    };

    prepareSaveInfo.profile = function () {
        var curDate = new Date();

        return {
                flips_number: 50,
                sessions_number: 1,
                registration_date: curDate,
                last_seen_date: curDate,
                registration_week: getWeekNumber()
            }
    };

    this.createNewProfile = function (options, callback) {
        var gameProf;
        var userObj;
        var deviceObj;

        async.waterfall([

            function (cb) {
                userObj = prepareSaveInfo(CONSTANTS.INFO_TYPES.USER, options);

                UserModel
                    .forge()
                    .save(userObj)
                    .then(function (user) {
                        cb(null, user)
                    })
                    .catch(function (err) {
                        cb(err)
                    })
            },

            function (user, cb) {

                if (options.facebook_id) {

                    PostGre.knex(TABLES.FB_NOTIFICATIONS)
                        .insert({
                            facebook_id: options.facebook_id
                        })
                        .then(function () {
                            cb(null, user)
                        })
                        .catch(function (err) {
                            cb(err)
                        })

                } else {
                    cb(null, user);
                }
            },
            function (user, cb) {
                deviceObj = prepareSaveInfo(CONSTANTS.INFO_TYPES.DEVICE, options);
                deviceObj.user_id = user.id;

                DeviceModel
                    .forge({
                        device_id: options.device_id
                    })
                    .fetch()
                    .then(function (device) {

                        if (device && device.id) {
                            device
                                .save(deviceObj, {
                                    patch: true
                                })
                                .then(function (device) {
                                        cb(null, device)

                                })
                                .catch(function (err) {
                                    cb(err)
                                })

                        } else {
                            DeviceModel
                                .forge({
                                    device_id: options.device_id
                                })
                                .save(deviceObj)
                                .then(function (device) {
                                    cb(null, device)
                                })
                                .catch(function (err) {
                                    cb(err)
                                })
                        }
                    })
                    .catch(function (err) {
                        cb(err)
                    })
            },

            function (device, cb) {
                gameProf = prepareSaveInfo(CONSTANTS.INFO_TYPES.PROFILE);
                gameProf.device_id = device.id;
                gameProf.user_id = device.get('user_id');

                GameProfileModel
                    .forge()
                    .save(gameProf)
                    .then(function (profile) {
                        cb(null, profile)
                    })
                    .catch(function (err) {
                        cb(err)
                    })
            }

        ], function (err, profile) {

            if (err) {
                return callback(err)
            } else {

                PostGre.knex(TABLES.USERS_PROFILE)
                    .select(TABLES.GAME_PROFILE + '.updated_at', TABLES.GAME_PROFILE + '.id as id', TABLES.GAME_PROFILE + '.uuid')
                    .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
                    .leftJoin(TABLES.DEVICE, TABLES.GAME_PROFILE + '.device_id', TABLES.DEVICE + '.id')
                    .where(TABLES.GAME_PROFILE + '.id', profile.id)
                    .then(function (profile) {
                        callback(null, profile)
                    })
                    .catch(function (err) {
                        callback(err)
                    })
            }
        })
    };

    this.updateUser = function (uid, options, callback) {
        var userSaveInfo = prepareSaveInfo(CONSTANTS.INFO_TYPES.USER, options);

        PostGre.knex(TABLES.GAME_PROFILE)
            .select('user_id')
            .where('uuid', uid)
            .then(function (id) {

                PostGre.knex(TABLES.USERS_PROFILE)
                    .where('id', id[0].user_id)
                    .returning('*')
                    .update(userSaveInfo)
                    .then(function (user) {
                        callback(null, user[0])
                    })
                    .catch(function (err) {
                        callback(err)
                    })
            })
            .catch(function (err) {
                callback(err)
            })
    };

    this.enterGuest = function (options, callback) {
        var uId = options.uId;
        var deviceId = options.device_id;
        var sessionLength = options['session_length'];
        var curDate = new Date().toISOString();
        var deviceObj = prepareSaveInfo(CONSTANTS.INFO_TYPES.DEVICE, options);
        var err;

        async.series([
            function (cb) {
                PostGre.knex
                    .raw(
                        'UPDATE  ' + TABLES.DEVICE + ' d SET user_id = u.id ' +
                        'FROM ' + TABLES.GAME_PROFILE + ' g, ' + TABLES.USERS_PROFILE + ' u ' +
                        'WHERE   u.id = g.user_id and g.uuid = \'' + uId + '\'  AND d.device_id = \'' + deviceId + '\' ' +
                        'RETURNING d.id'
                    )
                    .then(function (result){

                        PostGre.knex(TABLES.DEVICE)
                            .where('id', result.rows[0].id)
                            .update(deviceObj)
                            .then(function () {
                                cb()
                            })
                            .catch(function (err) {
                                cb(err)
                            })
                    })
                    .catch(function (err) {
                        cb(err)
                    })
            },
            function (cb) {
                PostGre.knex
                    .raw(
                        'UPDATE  ' + TABLES.GAME_PROFILE + ' g SET sessions_number = sessions_number + 1 , last_seen_date = ' + '\'' + curDate + '\' , ' +
                            'session_max_length = ( ' +
                            'CASE WHEN session_max_length < \'' + sessionLength + '\' ' +
                            'THEN \'' + sessionLength + '\' ' +
                            'ELSE session_max_length ' +
                            'END ) ' +
                        'FROM ' + TABLES.DEVICE + ' d, ' + TABLES.USERS_PROFILE + ' u ' +
                        'WHERE   u.id = g.user_id and d.id = g.device_id and g.uuid =\'' + uId + '\' AND d.device_id = \'' + deviceId + '\' ' +
                        'RETURNING  g.updated_at, g.id as id, g.uuid'
                    )
                    .then(function (profile) {

                        if (profile && profile.rows && profile.rows.length) {
                            cb(null, profile.rows[0])

                        } else {
                            err = new Error(RESPONSES.DATABASE_ERROR);
                            err.status = 500;
                            cb(err)
                        }
                    })
                    .catch(function (err) {
                        cb(err)
                    })
            }
        ], function (err, result) {

            if (err) {
                return callback(err)
            }

            callback(null, result[1])
        })

    };

    this.enterFBUser = function (options, callback) {
        var deviceId = options.device_id;
        var fbId = options.facebook_id;
        var sessionLength = options['session_length'];
        var curDate = new Date().toISOString();
        var userSaveInfo = prepareSaveInfo(CONSTANTS.INFO_TYPES.USER, options);
        var deviceInfo = prepareSaveInfo(CONSTANTS.INFO_TYPES.DEVICE, options);

        async.waterfall([
            function (cb) {

                PostGre.knex(TABLES.GAME_PROFILE)
                    .select('user_id')
                    .where('uuid', options.uId)
                    .then(function (result) {

                        PostGre.knex(TABLES.USERS_PROFILE)
                            .update(userSaveInfo)
                            .where('id', result[0].user_id)
                            .then(function (user) {

                                gameProfHelper.achievementsTrigger({
                                    uuid: options.uId,
                                    name: CONSTANTS.ACHIEVEMENTS.FB_CONNECT.NAME

                                }, function (err) {

                                    err ? cb(err) :  cb(null, user);
                                });
                                /*cb(null, user);*/
                            })
                            .catch(function (err) {
                                cb(err)
                            })
                    })
                    .catch(function (err) {
                        cb(err)
                    })
            },

            function (user, cb) {
                PostGre.knex
                    .raw(
                        'UPDATE  ' + TABLES.DEVICE + ' d SET user_id = u.id ' +
                        'FROM ' + TABLES.GAME_PROFILE + ' g, ' + TABLES.USERS_PROFILE + ' u ' +
                        'WHERE   u.id = g.user_id AND  u.facebook_id =  \'' + fbId + '\'  AND ' + 'd.device_id =  \'' + deviceId + '\' ' +
                        'RETURNING d.id'
                    )
                    .then(function (result) {

                        if (result.rows.length && result.rows[0]) {

                            PostGre.knex(TABLES.DEVICE)
                                .where('id', result.rows[0].id)
                                .update(deviceInfo)
                                .then(function () {
                                    cb(null, result.rows[0].id)
                                })
                                .catch(function (err) {
                                    cb(err)
                                })

                        } else {

                            PostGre.knex(TABLES.DEVICE)
                                .insert(deviceInfo, 'id')
                                .then(function () {
                                    PostGre.knex
                                        .raw(
                                            'UPDATE  ' + TABLES.DEVICE + ' d SET user_id = u.id ' +
                                            'FROM ' + TABLES.GAME_PROFILE + ' g, ' + TABLES.USERS_PROFILE + ' u ' +
                                            'WHERE   u.id = g.user_id and  u.facebook_id =  \'' + fbId + '\'  AND ' + 'd.device_id =  \'' + deviceId + '\' ' +
                                            'RETURNING d.id'
                                        )
                                        .then(function (result) {
                                                cb(null, result.rows[0].id)
                                        })
                                        .catch(function (err) {
                                            cb(err)
                                        })

                                })
                                .catch(function (err) {
                                    cb(err)
                                })
                        }
                    })
                    .catch(function (err) {
                        cb(err)
                    })

            },

            function (dId, cb) {
                PostGre.knex
                    .raw(
                        'UPDATE ' + TABLES.FB_NOTIFICATIONS + ' fb set ' +
                        'is_newbie = ( ' +
                            'case when extract(days from (current_timestamp - gp.last_seen_date)) >= 28 ' +
                            'then true ' +
                            'else is_newbie ' +
                            'end) ' +
                        'from ' + TABLES.USERS_PROFILE + ' up, ' + TABLES.GAME_PROFILE + ' gp ' +
                        'where fb.facebook_id = \'' + fbId + '\'  and up.facebook_id = \'' + fbId + '\'  and up.id = gp.user_id '
                    )
                    .exec(function (err) {
                        if (err) {
                            cb(err)
                        } else {
                            cb(null, dId)
                        }
                    });
            },

            function (id, cb) {
                PostGre.knex
                    .raw(
                        'UPDATE  ' + TABLES.GAME_PROFILE + ' g SET sessions_number = sessions_number + 1 , device_id = ' + id + ' , last_seen_date = ' + '\'' + curDate + '\' , ' +
                            'session_max_length = ( ' +
                            'case when session_max_length < \'' + sessionLength + '\' ' +
                            'then \'' + sessionLength + '\' ' +
                            'else session_max_length ' +
                            'end ) ' +
                        'from ' + TABLES.DEVICE + ' d, ' + TABLES.USERS_PROFILE + ' u ' +
                        'where   u.id = g.user_id and d.id = g.device_id and u.facebook_id =  \'' + fbId + '\' ' +
                        'RETURNING g.updated_at , g.id as id, g.user_id, g.uuid'
                    )
                    .exec(function (err, result) {
                        if (err) {
                            cb(err)
                        } else {
                            cb(null, result)
                        }
                    });
            }

        ], function (err, result){
            if (err) {
                return callback(err)
            }
            callback(null, result.rows[0])
        })
    };

    this.isExistingFBUser = function (FBid, callback) {

        PostGre.knex(TABLES.USERS_PROFILE)
            .select(TABLES.GAME_PROFILE + '.uuid')
            .leftJoin(TABLES.GAME_PROFILE, TABLES.GAME_PROFILE + '.user_id', TABLES.USERS_PROFILE + '.id')
            .where('facebook_id', FBid)
            .then(function (result) {

                if (result[0] && result[0].uuid) {
                    callback(null, result[0].uuid)

                } else {
                    callback(null, false)
                }
            })
            .catch(function (err) {
                callback(err)
            })
    };

    this.getExistingUser = function (options, callback) {

        PostGre.knex(TABLES.GAME_PROFILE)
            .select(TABLES.GAME_PROFILE + '.updated_at',TABLES.GAME_PROFILE + '.id' + ' as id', TABLES.GAME_PROFILE + '.uuid')
            .leftJoin(TABLES.USERS_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
            .leftJoin(TABLES.DEVICE, TABLES.GAME_PROFILE + '.device_id', TABLES.DEVICE + '.id')
            .where(function () {
                if (options && options.facebook_id) {
                    this.where(TABLES.USERS_PROFILE + '.facebook_id', options.facebook_id)
                } else {
                    this.where(TABLES.DEVICE + '.device_id', options.device_id)
                        .whereNull(TABLES.USERS_PROFILE + '.facebook_id')
                }

            })
            .then(function (profile) {
                callback(null, profile)
            })
            .catch(function (err) {
                callback(err)
            })
    };

    this.mergeProfiles = function (fbProfUid, options, callback) {
        var mergeuid = options.uId;
        var uids = [fbProfUid, mergeuid];
        var userId;
        var fbUserId;

        var mergeGid;
        var fbGid;
        var ids;

        var maxPointProf;
        var minPointProf;

        var mergedProfile;
        var mergedBoosters;

        async.series([
            function (cb) {
                PostGre.knex(TABLES.GAME_PROFILE)
                    .select('*')
                    .whereIn('uuid', uids)
                    .then(function (profiles) {
                        userId = (profiles[0].uuid === fbProfUid) ? profiles[1].user_id : profiles[0].user_id;
                        fbUserId = (profiles[0].uuid === fbProfUid) ? profiles[0].user_id : profiles[1].user_id;

                        mergeGid = (profiles[0].uuid === fbProfUid) ? profiles[1].id : profiles[0].id;
                        fbGid = (profiles[0].uuid === fbProfUid) ? profiles[0].id : profiles[1].id;
                        ids = [mergeGid, fbGid];

                        maxPointProf =  (profiles[0].points_number > profiles[1].points_number) ? profiles[0].id : profiles[1].id;
                        minPointProf =  (profiles[0].points_number < profiles[1].points_number) ? profiles[0].id : profiles[1].id;

                        mergedProfile = {
                            registration_date: (profiles[0].registration_date > profiles[1].registration_date) ? profiles[1].registration_date : profiles[0].registration_date,
                            registration_week: (parseInt(profiles[0].registration_week) > parseInt(profiles[1].registration_week)) ? profiles[1].registration_week : profiles[0].registration_week,
                            sessions_number: profiles[0].sessions_number + profiles[1].sessions_number + 1,
                            session_max_length: (parseInt(profiles[0].session_max_length) > parseInt(profiles[1].session_max_length)) ? profiles[0].session_max_length : profiles[1].session_max_length,
                            points_number: (profiles[0].points_number > profiles[1].points_number) ? profiles[0].points_number : profiles[1].points_number,
                            stars_number: (profiles[0].points_number > profiles[1].points_number) ? profiles[0].stars_number : profiles[1].stars_number,
                            coins_number: (profiles[0].coins_number > profiles[1].coins_number) ? profiles[0].coins_number : profiles[1].coins_number,
                            pogs_number: (profiles[0].points_number > profiles[1].points_number) ? profiles[0].pogs_number : profiles[1].pogs_number,
                            flips_number: (profiles[0].flips_number > profiles[1].flips_number) ? profiles[0].flips_number : profiles[1].flips_number,
                            real_spent: profiles[0].real_spent + profiles[1].real_spent,
                            soft_currency_spent: profiles[0].soft_currency_spent + profiles[1].soft_currency_spent,
                            flips_spent: profiles[0].flips_spent + profiles[1].flips_spent,
                            tools_used: (profiles[0].tools_used > profiles[1].tools_used) ? profiles[0].tools_used : profiles[1].tools_used,
                            last_purchase_date: (profiles[0].last_purchase_date > profiles[1].last_purchase_date) ? profiles[1].last_purchase_date : profiles[0].last_purchase_date,
                            last_seen_date: new Date(),
                            first_purchase_date: (profiles[0].first_purchase_date < profiles[1].first_purchase_date) ? profiles[1].first_purchase_date : profiles[0].first_purchase_date,
                            offers_seen: profiles[0].offers_seen + profiles[1].offers_seen,
                            offers_bought: profiles[0].offers_bought + profiles[1].offers_bought,
                            promo_seen: profiles[0].promo_seen + profiles[1].promo_seen
                        };

                        cb()
                    })
                    .catch(function (err) {
                        cb(err)
                    })
            },

            function (cb) {
                PostGre.knex
                    .raw(
                        'SELECT booster_id, sum(quantity) as quantity, sum(flips_left) as flips_left, bool_or(is_active) as is_active, ' + fbGid + ' as game_profile_id ' +
                        'FROM ' + TABLES.USERS_BOOSTERS + ' ' +
                        'WHERE game_profile_id in (\'' + mergeGid + '\', \'' + fbGid + '\') ' +
                        'GROUP BY booster_id'
                    )
                    .then(function (boosters) {
                        mergedBoosters = boosters.rows;
                        cb()
                    })
                    .catch(function (err) {
                        cb(err)
                    })
            }

        ], function (err) {

            if (err) {
                return callback(err)
            }

            async.series([

                function (cb) {
                    PostGre.knex(TABLES.USERS_BOOSTERS)
                        .whereIn('game_profile_id', ids)
                        .delete()
                        .then(function () {
                            cb()
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                },

                function (cb) {
                    PostGre.knex(TABLES.USERS_ACHIEVEMENTS)
                        .where('game_profile_id', minPointProf)
                        .delete()
                        .then(function () {
                            cb()
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                },

                function (cb) {
                    PostGre.knex(TABLES.USERS_SMASHES)
                        .where('game_profile_id', minPointProf)
                        .delete()
                        .then(function () {
                            cb()
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                },

                function (cb) {
                    PostGre.knex(TABLES.USERS_PURCHASES)
                        .where('game_profile_id', mergeGid)
                        .update({
                            game_profile_id: fbGid
                        })
                        .then(function () {
                            cb()
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                },

                function (cb) {
                    PostGre.knex(TABLES.USERS_SMASHES)
                        .where('game_profile_id', maxPointProf)
                        .update({
                            game_profile_id: fbGid
                        })
                        .then(function () {
                            cb()
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                },

                function (cb) {
                    PostGre.knex(TABLES.USERS_ACHIEVEMENTS)
                        .where('game_profile_id', maxPointProf)
                        .update({
                            game_profile_id: fbGid
                        })
                        .then(function () {
                            cb()
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                },

                function (cb) {
                    PostGre.knex(TABLES.GAME_PROFILE)
                        .where('id', mergeGid)
                        .delete()
                        .then(function () {
                            cb()
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                },

                function (cb) {
                    PostGre.knex(TABLES.USERS_PROFILE)
                        .where('id', userId)
                        .delete()
                        .then(function () {
                            cb()
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                },

                function (cb) {
                    PostGre.knex(TABLES.USERS_BOOSTERS)
                        .whereIn('game_profile_id', ids)
                        .delete()
                        .then(function () {
                            cb()
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                },

                function (cb) {
                    PostGre.knex(TABLES.USERS_BOOSTERS)
                        .insert(mergedBoosters)
                        .then(function () {
                            cb()
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                },


                function (cb) {
                    PostGre.knex(TABLES.DEVICE)
                        .where('user_id', userId)
                        .update({
                            user_id: fbUserId
                        })
                        .then(function () {
                            cb()
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                },

                function (cb) {
                        PostGre.knex(TABLES.GAME_PROFILE)
                            .where('id', fbGid)
                            .update(mergedProfile)
                            .returning('*')
                            .then(function (profile) {
                                cb(null, profile)
                            })
                            .catch(function (err) {
                                cb(err)
                            })
                }

            ], function (err, result) {

                if (err) {
                    return callback(err)
                }

                callback(null, result[result.length - 1][0])
            })
        })

    };

};

module.exports = UserProfile;

