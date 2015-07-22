var RESPONSES = require('../constants/responseMessages');
var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
var async = require('async');
var _ = require('underscore');
var Session = require('./sessions');
var Users;

Users = function (PostGre) {
    var UserModel = PostGre.Models[MODELS.USERS_PROFILE];
    var DeviceModel = PostGre.Models[MODELS.DEVICE];
    var GameProfileModel = PostGre.Models[MODELS.GAME_PROFILE];
    var session = new Session(PostGre);

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
                case 'device_firmware':
                    result[key] = value;
                    break;

            }

        }
        result.updated_at = new Date();
        return result;
    };

    function createNewProfile (options, callback) {
        var err;
        var gameProf;
        var userObj;
        var deviceObj;

        async.waterfall([
            function (cb) {
                userObj = prepareUserSaveInfo(options);

                UserModel
                    .forge()
                    .save(userObj)
                    .then(function (user) {
                        if (user && user.id) {
                            cb(null, user)
                        } else {
                            err = new Error(RESPONSES.DATABASE_ERROR);
                            err.status = 500;
                            cb(err)
                        }
                    })
                    .otherwise(cb)
            },

            function (user, cb) {
                deviceObj = prepareDeviceSaveInfo(options);
                deviceObj.user_id = user.id;

                DeviceModel
                    .forge({
                        device_id: options.deviceId
                    })
                    .save(deviceObj)
                    .then(function (device) {
                        if (device && device.id) {
                            cb(null, device)
                        } else {
                            err = new Error(RESPONSES.DATABASE_ERROR);
                            err.status = 500;
                            cb(err)
                        }
                    })
                    .otherwise(cb)
            },

            function (device, cb) {
                gameProf = {
                    device_id: device.id,
                    user_id: device.get('user_id'),
                    registration_date: new Date(),
                    registration_week: getWeekNumber()
                };

                GameProfileModel
                    .forge()
                    .save(gameProf)
                    .then(function (profile) {
                        if (profile && profile.id) {
                            cb(null, profile)
                        } else {
                            err = new Error(RESPONSES.DATABASE_ERROR);
                            err.status = 500;
                            cb(err)
                        }
                    })
                    .otherwise(cb)
            }

        ], function (err, profile) {
            if (err) {
                return callback(err)
            } else {
                callback(null, profile)
            }
        })
    };

    function updateUser (uid, options, callback) {

        GameProfileModel
            .forge({
                id: uid
            })
            .then(function (profile) {

                UserModel
                    .forge({
                        id: profile.get('user_id')
                    })
                    .save(
                        options,
                    {
                        patch: true
                    }
                    )
                    .then(function () {
                        callback(null, profile)
                    })
                    .otherwise(callback)
            })
            .otherwise(callback)
    };

    this.signUp = function (req, res, next) {
        var options = req.body;
        var err;

        if (options && options.device_id) {
            DeviceModel
                .forge({
                    device_id: options.device_id
                })
                .fetch()
                .then(function (device) {

                    if (device && device.id) {
                        GameProfileModel
                            .forge({
                                device_id: device.id
                            })
                            .fetch()
                            .then(function (profile) {
                               session.register(req, res, profile)
                            })
                            .otherwise(next)

                    } else {
                        createNewProfile(options, function (err, profile) {
                            if (err) {
                                return next(err)
                            }
                            req.session.loggedIn = true;
                            req.session.uId = profile.id;

                            res.status(201).send({
                                success: RESPONSES.CREATED,
                                uId: profile.id
                            });
                        })
                    }
                })
                .otherwise(next)
        } else {
            err = new Error(RESPONSES.BAD_INCOMING_PARAMS);
            err.status = 404;
            next(err);
        }
    };

    this.signIn = function (req, res, next) {
        var options = req.body;
        var uId = options.uId;
        var deviceId = options.device_id;
        var err;

        PostGre.knex
            .raw(
                'SELECT  g.id, d.device_id FROM ' + TABLES.GAME_PROFILE + ' g ' +
                'left join ' + TABLES.DEVICE + ' d on d.id = g.device_id ' +
                'where g.id =' + uId + ' and d.device_id = \'' + deviceId + '\''
            )
            .then(function (profile) {
                if (profile && profile.rows && profile.rows.length) {

                    session.register(req, res, profile.rows[0])

                } else {
                    err = new Error(RESPONSES.DATABASE_ERROR);
                    err.status = 500;
                    next(err)
                }
            })
            .otherwise(next)
    };

    this.updateUserProfile = function (req, res, next) {
        var uid = req.params.id;
        var options = req.body;
        var userSaveInfo = prepareUserSaveInfo(options);
        var err;

        if (options && uid) {

            if (options.facebook_id) {

                PostGre.knex(TABLES.USERS_PROFILE)
                    .where('facebook_id', options.facebook_id)
                    .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
                    .then(function (result) {

                        if (result[0]) {
                            session.register(req, res, result[0])
                        } else {
                            updateUser(uid, userSaveInfo, function (err, result) {
                                if (err) {
                                    return next(err)
                                }
                                session.register(req, res, result)
                            })
                        }
                    })
                    .otherwise(next)
            } else {
                updateUser(uid, userSaveInfo, function (err, result) {

                    if (err) {
                        return next(err)
                    }
                    session.register(req, res, result)
                })
            }

        } else {
            err = new Error(RESPONSES.BAD_INCOMING_PARAMS);
            err.status = 500;
            next(err)
        }
    };

    this.signOut = function (req, res, next) {
        session.kill(req, res);
    };

   /* this.getProfileById = function (req, res, next) {
        var uid = req.params.id;

        PostGre.knex(TABLES.USERS_PROFILE)
            .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
            .where(TABLES.GAME_PROFILE + '.id', uid)
            .then(function (profile) {
                res.status(200).send(profile[0])
            })
            .otherwise(next)
    };*/

    /*this.updateProfile = function (req, res, next) {
        var uid = req.params.id;
        var options = req.body;
        var updatedObj = prepareGameProfSaveInfo(options);

        GameProfileModel
            .forge({
                id: uid
            })
            .save(
                updatedObj,
            {
                patch: true
            })
            .then(function () {
                res.status(200).send({
                    success: RESPONSES.UPDATED
                })
            })
            .otherwise(next)
    };*/

    this.getTopRankList = function (req, res, next) {

        PostGre.knex(TABLES.USERS_PROFILE)
            .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
            .select('first_name', 'last_name', 'points_number')
            .orderBy('points_number', 'desc')
            .limit(25)
            .then(function (profiles) {
                res.status(200).send(profiles)
            })
            .otherwise(next)
    };

    this.addFBFriends = function (req, res, next) {
        var addFriendsList = req.body.friendsList;
        var uid = req.session.uId;
        var queryStr = '';
        var curDate = new Date().toISOString();


        for (var i = addFriendsList.length; i--;) {
            queryStr += '\'' + addFriendsList[i] + '\'' + ','
        }

        queryStr = queryStr.slice(0, -1);
        queryStr ='('  + queryStr + ')';

        PostGre.knex
            .raw(
                'insert into ' + TABLES.FRIENDS + ' (game_profile_id, friend_game_profile_id, updated_at, created_at) ' +
                'select ' + uid + ' as g_id, g.id, ' + '\'' + curDate + '\'' + ' as updated_at, ' + '\'' + curDate + '\'' + ' as created_at from users_profile u ' +
                'left join ' + TABLES.GAME_PROFILE + ' g on g.user_id = u.id ' +
                'where facebook_id in ' + queryStr +
                'and g.id not in (select friend_game_profile_id from ' + TABLES.FRIENDS + '  where game_profile_id = ' + uid + ')'
            )
            .then(function () {
                res.status(200).send({success: RESPONSES.UPDATED})
            })
            .otherwise(next)
    };

    this.getFriends = function (req, res, next) {
        var uid = req.session.uId;

        PostGre.knex
            .raw(
                'select g.id, g.points_number, g.stars_number, u.first_name, u.last_name from ' + TABLES.GAME_PROFILE + ' g ' +
                'left join ' + TABLES.USERS_PROFILE + ' u on g.user_id = u.id ' +
                'where g.id in (select friend_game_profile_id from ' + TABLES.FRIENDS + ' where game_profile_id = ' + uid +')'
            )
            .then(function (friends) {
                res.status(200).send(friends.rows)
            })
            .otherwise(next)
    };

    this.getFriendsTopRankList = function (req, res, next) {
        var uid = req.session.uId;

        PostGre.knex
            .raw(
            'select g.id, g.points_number, g.stars_number, u.first_name, u.last_name from ' + TABLES.GAME_PROFILE + ' g ' +
            'left join ' + TABLES.USERS_PROFILE + ' u on g.user_id = u.id ' +
            'where g.id in (select friend_game_profile_id from ' + TABLES.FRIENDS+ ' where game_profile_id = ' + uid +') ' +
            'order by g.points_number desc ' +
            'limit 25'
            )
            .then(function (friends) {
                res.status(200).send(friends.rows)
            })
            .otherwise(next)

    };

};

module.exports = Users;

