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
                        date: profile.updated_at.toLocaleString()
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
                                date: profile.updated_at.toLocaleString()
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
                                date: profile.updated_at.toLocaleString()
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
                            date: profile[0].updated_at.toLocaleString()
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
                                date: profile[0].updated_at.toLocaleString()
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
                    'SELECT g.id, g.points_number, g.stars_number, u.first_name, u.last_name FROM ' + TABLES.GAME_PROFILE + ' g ' +
                    'LEFT JOIN ' + TABLES.USERS_PROFILE + ' u ON g.user_id = u.id ' +
                    'WHERE g.id IN (SELECT friend_game_profile_id FROM ' + TABLES.FRIENDS + ' WHERE game_profile_id = (' +
                    '   SELECT id FROM game_profile WHERE uuid = \'' + uid + '\')) ' +
                    'ORDER BY g.points_number DESC ' +
                    'LIMIT 25'
                )
                .then(function (friends) {
                    res.status(200).send(friends.rows)
                })
                .catch(function (err) {
                    next(err)
                })

        } else {

            PostGre.knex(TABLES.USERS_PROFILE)
                .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
                .select('first_name', 'last_name', 'points_number')
                .orderBy('points_number', 'desc')
                .limit(25)
                .then(function (profiles) {
                    res.status(200).send(profiles)
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

};

module.exports = Users;

