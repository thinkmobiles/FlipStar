var RESPONSES = require('../constants/responseMessages');
var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
var async = require('async');
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

    function get_current_age(date) {
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
                    result['age_range'] = get_current_age(value);
                    break;
                case 'timezone':
                    result[key] = value;
                    break;
                case 'phone_number':
                    result[key] = value;
                    break;

            }

        }
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
                case 'convert_version':
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
        return result;
    };

    function prepareGameProfSaveInfo (options) {
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
                    result['age_range'] = get_current_age(value);
                    break;
                case 'timezone':
                    result[key] = value;
                    break;
                case 'phone_number':
                    result[key] = value;
                    break;

            }

        }
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
                    .save()
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
                    .forge(gameProf)
                    .save()
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

    this.signUp = function (req, res, next) {
        var options = req.body;
        var err;

        if (options && options.deviceId) {
            DeviceModel
                .forge({
                    id: options.deviceId
                })
                .fetch()
                .then(function (device) {
                    if (device && device.id) {
                        GameProfileModel
                            .forge({

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
        var deviceId = options.deviceId;
        var err;

        PostGre.knex
            .raw(
                'SELECT  game_profile.id, device.device_id FROM game_profile ' +
                'left join device  on device.id = game_profile.device_id ' +
                'where game_profile.id =' + uId + ' and device.device_id = \'' + deviceId + '\''
            )
            .then(function (profile) {
                if (profile && profile.rows && profile.rows.length) {
                    session.register(req, res, profile.rows)
                } else {
                    err = new Error(RESPONSES.DATABASE_ERROR);
                    err.status = 500;
                    next(err)
                }
            })
            .otherwise(next)

        /*GameProfileModel
            .query(function (qb) {
                qb.leftJoin('device', 'device.id', 'game_profile.device_id')
            })
            .fetch()
            .then(function (profile) {
                if (profile && profile.id) {
                    res.send(profile)
                    //session.register(req, res, profile)
                } else {
                    err = new Error(RESPONSES.DATABASE_ERROR);
                    err.status = 500;
                    next(err)
                }
            })
            .otherwise(next)*/
    };

};

module.exports = Users;

