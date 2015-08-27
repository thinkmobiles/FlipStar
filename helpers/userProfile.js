var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
var RESPONSES = require('../constants/responseMessages');
var async = require('async');
var _ = require('lodash');
var Session = require('../handlers/sessions');
var GameProfHelper = require('../helpers/gameProfile');
var Users;

UserProfile = function (PostGre) {
    var gameProfHelper = new GameProfHelper(PostGre);
    var UserModel = PostGre.Models[MODELS.USERS_PROFILE];
    var DeviceModel = PostGre.Models[MODELS.DEVICE];
    var GameProfileModel = PostGre.Models[MODELS.GAME_PROFILE];

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
    };

    function getCurrentAge(date) {
        return ((new Date().getTime() - new Date(date)) / (24 * 3600 * 365.25 * 1000)) | 0;
    };

    function prepareDeviceSaveInfo (options) {
        var result = {};
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
                result['device_firmware'] = options['push_operator']
            }
            result[value[i]] = options[value[i]]? options[value[i]] : null
        }

        result.updated_at = new Date();
        return result;
    };

    function prepareUserSaveInfo (options) {
        var result = {};
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
                result['age_range'] = getCurrentAge(value)
            }
            result[value[i]] = options[value[i]]? options[value[i]] : null
        }

        result.updated_at = new Date();
        return result;
    };

    this.createNewProfile = function (options, callback) {
        var gameProf;
        var userObj;
        var deviceObj;

        async.waterfall([

            function (cb) {
                userObj = prepareUserSaveInfo(options);

                UserModel
                    .forge()
                    .save(userObj)
                    .exec(function (err, user) {
                        if (err) {
                            cb(err)
                        } else {
                            cb(null, user)
                        }
                    })
            },

            function (user, cb) {

                if (options.facebook_id) {
                    PostGre.knex(TABLES.FB_NOTIFICATIONS)
                        .insert({
                            facebook_id: options.facebook_id
                        })
                        .exec(function (err, result) {
                            if (err) {
                                cb(err);
                            } else {
                                cb(null, user);
                            }

                        })
                } else {
                    cb(null, user);
                }
            },
            function (user, cb) {
                deviceObj = prepareDeviceSaveInfo(options);
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
                                .exec(function (err, device) {
                                    if (err) {
                                        cb(err)
                                    } else {
                                        cb(null, device)
                                    }
                                })
                        } else {
                            DeviceModel
                                .forge({
                                    device_id: options.device_id
                                })
                                .save(deviceObj)
                                .exec(function (err, device) {
                                    if (err) {
                                        cb(err)
                                    } else {
                                        cb(null, device)
                                    }
                                })
                        }
                    })
                    .otherwise(cb)
            },

            function (device, cb) {
                gameProf = {
                    device_id: device.id,
                    user_id: device.get('user_id'),
                    flips_number: 50,
                    sessions_number: 1,
                    registration_date: new Date(),
                    last_seen_date: new Date(),
                    registration_week: getWeekNumber()
                };

                GameProfileModel
                    .forge()
                    .save(gameProf)
                    .exec(function (err, profile) {
                        if (err) {
                            cb(err)
                        } else {
                            cb(null, profile)
                        }
                    })
            }

        ], function (err, profile) {
            if (err) {
                return callback(err)
            } else {
                PostGre.knex(TABLES.USERS_PROFILE)
                    .select(TABLES.GAME_PROFILE + '.updated_at', TABLES.GAME_PROFILE + '.id as id')
                    .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
                    .leftJoin(TABLES.DEVICE, TABLES.GAME_PROFILE + '.device_id', TABLES.DEVICE + '.id')
                    .where(TABLES.GAME_PROFILE + '.id', profile.id)
                    .exec(function (err, profile) {
                        if (err) {
                            callback(err)
                        } else {
                            callback(null, profile)
                        }
                    })
            }
        })
    };

    this.updateUser = function (uid, options, callback) {
        var userSaveInfo = prepareUserSaveInfo(options);

        PostGre.knex(TABLES.GAME_PROFILE)
            .select('user_id')
            .where('id', uid)
            .then(function (id) {

                PostGre.knex(TABLES.USERS_PROFILE)
                    .where('id', id[0].user_id)
                    .returning('*')
                    .update(userSaveInfo)
                    .exec(function (err, user) {
                        if (err) {
                            return callback(err)
                        }
                        callback(null, user[0])
                    })
            })
            .otherwise(callback)
    };

    this.enterGuest = function (options, callback) {
        var uId = options.uId;
        var deviceId = options.device_id;
        var sessionLength = options.session_length;
        var curDate = new Date().toISOString();
        var deviceObj = prepareDeviceSaveInfo(options);
        var err;

        async.series([
            function (cb) {
                PostGre.knex
                    .raw(
                        'UPDATE  ' + TABLES.DEVICE + ' d SET user_id = u.id ' +
                        'FROM ' + TABLES.GAME_PROFILE + ' g, ' + TABLES.USERS_PROFILE + ' u ' +
                        'WHERE   u.id = g.user_id and g.id = ' + uId + ' AND d.device_id = \'' + deviceId + '\' ' +
                        'RETURNING d.id'
                    )
                    .then(function (result){
                        PostGre.knex(TABLES.DEVICE)
                            .where('id', result.rows[0].id)
                            .update(deviceObj)
                            .exec(cb)
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
                        'WHERE   u.id = g.user_id and d.id = g.device_id and g.id =' + uId + ' AND d.device_id = \'' + deviceId + '\' ' +
                        'RETURNING  g.updated_at, g.id as id'
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
                    .otherwise(cb)
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
        var sessionLength = options.session_length;
        var curDate = new Date().toISOString();
        var userSaveInfo = prepareUserSaveInfo(options);
        var deviceInfo;

        async.waterfall([
            function (cb) {

                PostGre.knex(TABLES.GAME_PROFILE)
                    .select('user_id')
                    .where('id', options.uId)
                    .then(function (result) {

                        PostGre.knex(TABLES.USERS_PROFILE)
                            .update(userSaveInfo)
                            .where('id', result[0].user_id)
                            .exec(function (err, user) {
                                if (err) {
                                    return cb(err)
                                }
                                cb(null, user)
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
                            deviceInfo = prepareDeviceSaveInfo(options);

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
                            deviceInfo = prepareDeviceSaveInfo(options);

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
                                        .otherwise(cb)

                                })
                                .otherwise(cb)
                        }
                    })
                    .otherwise(cb)

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
                    .exec(function (err, result) {
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
                        'RETURNING g.updated_at , g.id as id, g.user_id'
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
            .select(TABLES.GAME_PROFILE + '.id')
            .leftJoin(TABLES.GAME_PROFILE, TABLES.GAME_PROFILE + '.user_id', TABLES.USERS_PROFILE + '.id')
            .where('facebook_id', FBid)
            .then(function (result) {

                if (result[0] && result[0].id) {
                    callback(null, result[0].id)

                } else {
                    callback(null, false)
                }
            })
            .otherwise(callback)
    };

    this.getExistingUser = function (options, callback) {
        PostGre.knex(TABLES.GAME_PROFILE)
            .select(TABLES.GAME_PROFILE + '.updated_at',TABLES.GAME_PROFILE + '.id' + ' as id')
            .leftJoin(TABLES.USERS_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
            .leftJoin(TABLES.DEVICE, TABLES.GAME_PROFILE + '.device_id', TABLES.DEVICE + '.id')
            .where(function () {
                this.where(TABLES.DEVICE + '.device_id', options.device_id)
                    .whereNull(TABLES.USERS_PROFILE + '.facebook_id')
            })
            .exec(function (err, profile) {
                if (err) {
                    return callback(err)
                }
                callback(null, profile)
            })
    };

    this.mergeProfiles = function (fbProfUid, options, callback) {
        var mergeuid = options.uId;
        var ids = [fbProfUid, mergeuid];
        var mergedProfile;
        var mergedSmashes;
        var mergedBosters;
        var mergedAchievements;

        async.parallel([
            function (cb) {
                PostGre.knex(TABLES.GAME_PROFILE)
                    .select('*')
                    .whereIn('id', ids)
                    .then(function (profiles) {
                        mergedProfile = {
                            registration_date: (profiles[0].registration_date > profiles[1].registration_date) ? profiles[1].registration_date : profiles[0].registration_date,
                            registration_week: (parseInt(profiles[0].registration_week) > parseInt(profiles[1].registration_week)) ? profiles[1].registration_week : profiles[0].registration_week,
                            sessions_number: profiles[0].sessions_number + profiles[1].sessions_number + 1,
                            session_max_length: (parseInt(profiles[0].session_max_length) > parseInt(profiles[1].session_max_length)) ? profiles[0].session_max_length : profiles[1].session_max_length,
                            stars_number: (profiles[0].stars_number > profiles[1].stars_number) ? profiles[0].stars_number : profiles[1].stars_number,
                            coins_number: (profiles[0].coins_number > profiles[1].coins_number) ? profiles[0].coins_number : profiles[1].coins_number,
                            pogs_number: (profiles[0].pogs_number > profiles[1].pogs_number) ? profiles[0].pogs_number : profiles[1].pogs_number,
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
                        'SELECT smash_id, sum(quantity) as quantity, bool_or(is_open) as is_open, ' + fbProfUid + ' as game_profile_id  ' +
                        'FROM ' + TABLES.USERS_SMASHES + ' ' +
                        'WHERE game_profile_id in (\'' + mergeuid + '\', \'' + fbProfUid + '\') ' +
                        'GROUP BY smash_id'
                    )
                    .then(function (smashes) {
                        mergedSmashes = smashes.rows;
                        cb()
                    })
                    .catch(function (err) {
                        cb(err)
                    })
            },

            function (cb) {
                PostGre.knex
                    .raw(
                        'SELECT booster_id, sum(quantity) as quantity, sum(flips_left) as flips_left, bool_or(is_active) as is_active, ' + fbProfUid + ' as game_profile_id ' +
                        'FROM ' + TABLES.USERS_BOOSTERS + ' ' +
                        'WHERE game_profile_id in (\'' + mergeuid + '\', \'' + fbProfUid + '\') ' +
                        'GROUP BY booster_id'
                    )
                    .then(function (boosters) {
                        mergedBosters = boosters.rows;
                        cb()
                    })
                    .catch(function (err) {
                        cb(err)
                    })
            },

            function (cb) {
                PostGre.knex
                    .raw(
                        'SELECT achievements_id, min(created_at) as created_at, ' + fbProfUid + ' as game_profile_id ' +
                        'FROM ' + TABLES.USERS_ACHIEVEMENTS + ' ' +
                        'where game_profile_id in  (\'' + mergeuid + '\', \'' + fbProfUid + '\') ' +
                        'group by achievements_id'
                    )
                    .then(function (achievements) {
                        mergedAchievements = achievements.rows;
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
                    
                }

            ], function (err, result) {
                if (err) {
                    return callback(err)
                }

                callback(null, result)
            })
        })

    };

};

module.exports = UserProfile;

