/**
 * @description User profile management module
 * @module usersProfile
 *
 */

var RESPONSES = require('../constants/responseMessages');
var TABLES = require('../constants/tables');
var CONSTANTS = require('../constants/constants');
var async = require('async');
var _ = require('underscore');
var Session = require('./sessions');
var GameProfHelper = require('../helpers/gameProfile');
var UserProfHelper = require('../helpers/userProfile');
var Users;

Users = function (PostGre) {
    var userProfHelper = new UserProfHelper(PostGre);
    var gameProfHelper = new GameProfHelper(PostGre);
    var session = new Session(PostGre);

    this.signIn = function (req, res, next) {
        var options = req.body;
        var err;
        var uid = options.uId;
        var fbId = options.facebook_id;

        var GUEST = !!(uid !== '-1' && !fbId);
        var FB_USER = !!(uid !== '-1' && fbId);

        if (options && options.device_id) {

            if (GUEST) {

                userProfHelper.enterGuest(options, function (err, profile) {
                    if (err) {
                        return next(err)
                    }
                    req.session.loggedIn = true;
                    req.session.uId = profile.uuid;

                    res.status(200).send({
                        uId: profile.uuid,
                        date: profile.updated_at.toLocaleString(),
                        achievement: req.achievement || 'none'
                    });
                })

            }  else if (FB_USER) {
                userProfHelper.isExistingFBUser(fbId, function (err, exist) {
                    if (err) {
                        return next(err)
                    }

                    if(exist && exist !== uid && uid !== '-1') {

                        userProfHelper.mergeProfiles(exist, options, function (err, profile) {
                            if (err) {
                                return next(err)
                            }
                            req.session.loggedIn = true;
                            req.session.uId = profile.uuid;

                            res.status(200).send({
                                uId: profile.uuid,
                                date: profile.updated_at.toLocaleString(),
                                achievement: req.achievement || 'none'
                            });
                        })
                    } else {

                        userProfHelper.enterFBUser(options, function (err, profile) {

                            if (err) {
                                return next(err)
                            }
                            req.session.loggedIn = true;
                            req.session.uId = profile.uuid;

                            res.status(200).send({
                                uId: profile.uuid,
                                date: profile.updated_at.toLocaleString(),
                                achievement: req.achievement || 'none'
                            });
                        })
                    }
                })


            }
            else {
                userProfHelper.getExistingUser(options, function (err, profile) {

                    if (err) {
                        return next(err)
                    }

                    if (profile[0] && profile[0].uuid) {
                        req.session.loggedIn = true;
                        req.session.uId = profile[0].uuid;

                        res.status(200).send({
                            uId: profile[0].uuid,
                            date: profile[0].updated_at.toLocaleString(),
                            achievement: req.achievement || 'none'
                        })

                    } else {
                        userProfHelper.createNewProfile(options, function (err, profile) {

                            if (err) {
                                return next(err)
                            }
                            req.session.loggedIn = true;
                            req.session.uId = profile[0].uuid;

                            res.status(201).send({
                                uId: profile[0].uuid,
                                date: profile[0].updated_at.toLocaleString(),
                                achievement: req.achievement || 'none'
                            });
                        })
                    }
                })
            }
        } else {
            err = new Error(RESPONSES.BAD_INCOMING_PARAMS);
            err.status = 404;
            next(err);
        }
    };

    this.updateUserProfile = function (req, res, next) {
        var uid = req.params.id;
        var options = req.body;
        var deviceId = options.device_id;
        var addFriendsList = options.friendsList;
        var queryStr = '';
        var curDate = new Date().toISOString();
        var err;

        if (options && deviceId && uid) {
            async.parallel([
                function (cb) {
                    userProfHelper.updateUser(uid, options, function (err, result) {

                        if (err) {
                            return cb(err)
                        }
                        cb(null, result)
                    })
                },

                function (cb) {

                    if (addFriendsList && addFriendsList.length) {
                        for (var i = addFriendsList.length; i--;) {
                            queryStr += '\'' + addFriendsList[i] + '\'' + ','
                        }

                        queryStr = queryStr.slice(0, -1);
                        queryStr ='('  + queryStr + ')';

                        PostGre.knex
                            .raw(
                                'INSERT into ' + TABLES.FRIENDS + ' (game_profile_id, friend_game_profile_id, updated_at, created_at) ' +
                                'SELECT ' + uid + ' AS g_id, g.id, ' + '\'' + curDate + '\'' + ' AS updated_at, ' + '\'' + curDate + '\'' + ' AS created_at FROM ' + TABLES.USERS_PROFILE + ' u ' +
                                'LEFT JOIN ' + TABLES.GAME_PROFILE + ' g ON g.user_id = u.id ' +
                                'WHERE facebook_id IN ' + queryStr +
                                'AND g.id NOT IN (SELECT friend_game_profile_id FROM ' + TABLES.FRIENDS + '  WHERE game_profile_id = ' + uid + ')'
                            )
                            .then(function () {
                                cb()
                            })
                            .catch(function (err) {
                                cb(err)
                            })

                    } else {
                        cb()
                    }
                }
            ], function (err, result) {

                if (err) {
                  return next(err)

                } else {
                    res.status(200).send(result[0])
                }

            })

        } else {
            err = new Error(RESPONSES.BAD_INCOMING_PARAMS);
            err.status = 500;
            next(err)
        }
    };

    this.signOut = function (req, res, next) {
        var curDate = new Date();
        var uid = req.session.uId;

        PostGre.knex(TABLES.GAME_PROFILE)
            .where('id', uid)
            .update('last_seen_date', curDate)
            .then(function () {
                session.kill(req, res, next)
            })
            .catch(function (err) {
                next(err)
            })
    };

    this.getTopRankList = function (req, res, next) {
        var type = req.query.type;
        var uid = req.session.uId;

        if (type === CONSTANTS.FRIENDS) {

            PostGre.knex
                .raw(
                'SELECT ' +
                'up.first_name  , up.facebook_id, gpf.game_rate_point ' +
                'FROM game_profile gp ' +
                'LEFT JOIN ' + TABLES.FRIENDS + ' fr ON fr.game_profile_id =  gp.id ' +
                'LEFT JOIN ' + TABLES.GAME_PROFILE + ' gpf ON gpf.id = fr.friend_game_profile_id  OR gp.uuid = gpf.uuid ' +
                'LEFT JOIN ' + TABLES.USERS_PROFILE + ' up ON gpf.user_id = up.id ' +
                'WHERE gp.uuid= \'' + uid + '\' ' +
                'GROUP BY gpf.game_rate_point, up.first_name, up.facebook_id ' +
                'ORDER BY game_rate_point DESC ' +
                'LIMIT 25'
                )
                .then(function (friends) {
                    res.status(200).send(friends.rows)
                })
                .catch(function (err) {
                    next(err)
                })

        } else {

            PostGre.knex
                .raw(
                'SELECT up.facebook_id, gp.game_rate_point, up.first_name ' +
                'FROM ' + TABLES.GAME_PROFILE + ' gp ' +
                'LEFT JOIN ' + TABLES.USERS_PROFILE + ' up ON up.id = gp.user_id ' +
                'ORDER BY gp.game_rate_point DESC ' +
                'LIMIT 25'
                )
                .then(function (profiles) {
                    res.status(200).send(profiles.rows)
                })
                .catch(function (err) {
                    next(err)
                })
        }

    };

    this.getFriends = function (req, res, next) {
        var uid = req.session.uId;

        PostGre.knex
            .raw(
                'SELECT g.id, g.points_number, g.stars_number, u.first_name, u.last_name FROM ' + TABLES.GAME_PROFILE + ' g ' +
                'LEFT JOIN ' + TABLES.USERS_PROFILE + ' u ON g.user_id = u.id ' +
                'WHERE g.id IN (SELECT friend_game_profile_id FROM ' + TABLES.FRIENDS + ' WHERE game_profile_id = (' +
                '   SELECT id FROM game_profile WHERE uuid = \'' + uid + '\')) '
            )
            .then(function (friends) {
                res.status(200).send(friends.rows)
            })
            .catch(function (err) {
                next(err)
            })
    };

    this.checkEnterAchievement = function (req, res, next) {
        var uuid = req.body.uId;
        var missedDays;
        var achievName;
        var REQ = req;

        if (uuid === '-1') {
            return next();
        }

        PostGre.knex
            .raw(
                'SELECT EXTRACT(days FROM current_timestamp - last_seen_date) as missed_days FROM ' + TABLES.GAME_PROFILE + ' ' +
                'WHERE uuid = \'' + uuid + '\''
            )
            .then(function (queryResult) {

                if (queryResult && queryResult.rows && queryResult.rows[0] && queryResult.rows[0].missed_days && queryResult.rows[0].missed_days > 0) {
                    missedDays = queryResult.rows[0].missed_days;
                    achievName = missedDays < 7 ? CONSTANTS.ACHIEVEMENTS.COME_BACK_1_DAY.NAME : CONSTANTS.ACHIEVEMENTS.COME_BACK_1_WEEK.NAME;
                    REQ.achievement = achievName;

                    gameProfHelper.achievementsTrigger({
                        uuid: uuid,
                        name: achievName

                    }, function (err) {

                        if (err) {
                            return next(err);
                        }

                        next();
                    })

                } else {
                    next();
                }

            })
            .catch(next)

    };

};

module.exports = Users;

