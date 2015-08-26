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
        var key;
        var value;

        for (key in options) {
            value = options[key];

            switch (key) {
                case 'device_id':
                    result[key] = value;
                    break;
                case 'device_type':
                    result[key] = value;
                    break;
                case 'device_timezone':
                    result[key] = value;
                    break;
                case 'push_token':
                    result[key] = value;
                    break;
                case 'push_operator':
                    result[key] = value;
                    result['device_firmware'] = value;
                    break;
                case 'content_version':
                    result[key] = value;
                    break;
                case 'screen_width':
                    result[key] = value;
                    break;
                case 'screen_height':
                    result[key] = value;
                    break;
                case 'device_model':
                    result[key] = value;
                    break;
                case 'device_manufacturer':
                    result[key] = value;
                    break;

            }

        }
        result.updated_at = new Date();
        return result;
    };

    function prepareUserSaveInfo (options) {
        var result = {};
        var key;
        var value;

        for (key in options) {
            value = options[key];

            switch (key) {
                case 'facebook_id':
                    result[key] = value;
                    break;
                case 'first_name':
                    result[key] = value;
                    break;
                case 'last_name':
                    result[key] = value;
                    break;
                case 'gender':
                    result[key] = value;
                    break;
                case 'email':
                    result[key] = value;
                    break;
                case 'language_id':
                    result[key] = value;
                    break;
                case 'country_id':
                    result[key] = value;
                    break;
                case 'birthday':
                    result[key] = value;
                    result['age_range'] = getCurrentAge(value);
                    break;
                case 'timezone':
                    result[key] = value;
                    break;
                case 'phone_number':
                    result[key] = value;
                    break;

            }

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
        var err;

        async.series([
            function (cb) {
                PostGre.knex
                    .raw(
                        'UPDATE  ' + TABLES.DEVICE + ' d SET user_id = u.id ' +
                        'FROM ' + TABLES.GAME_PROFILE + ' g, ' + TABLES.USERS_PROFILE + ' u ' +
                        'WHERE   u.id = g.user_id and g.id = ' + uId + ' AND d.device_id = \'' + deviceId + '\' '
                    )
                    .exec(cb)
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
        var deviceInfo;

        async.waterfall([
            function (cb) {
                PostGre.knex
                    .raw(
                        'UPDATE  ' + TABLES.DEVICE + ' d SET user_id = u.id ' +
                        'FROM ' + TABLES.GAME_PROFILE + ' g, ' + TABLES.USERS_PROFILE + ' u ' +
                        'WHERE   u.id = g.user_id and  u.facebook_id =  \'' + fbId + '\'  AND ' + 'd.device_id =  \'' + deviceId + '\' ' +
                        'RETURNING d.id'
                    )
                    .then(function (result) {
                        if (result.rows.length && result.rows[0]) {
                            cb(null, result.rows[0].id)
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
                        'RETURNING g.updated_at , g.id as id'
                    )
                    .exec(cb)
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
            .where('facebook_id', FBid)
            .then(function (result) {

                if (result[0] && result[0].id) {
                    callback(null, true)

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

};

module.exports = UserProfile;

