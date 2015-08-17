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

        var GUEST = !!(uid && !fbId);
        var UNKNOWN_FB_USER = !!(!uid && fbId);
        var KNOWN_FB_USER = !!(uid && fbId);

        if (options && options.device_id) {

            if (GUEST) {

                userProfHelper.enterGuest(options, function (err, profile) {
                    if (err) {
                        return next(err)
                    }
                    req.session.loggedIn = true;
                    req.session.uId = profile.id;

                    res.status(200).send(profile);
                })

            } else if (UNKNOWN_FB_USER) {

                userProfHelper.isExistingFBUser(fbId, function (err, result) {

                    if (err) {
                        return next(err)
                    }

                    if (result) {
                        userProfHelper.enterFBUser(options, function (err, profile) {

                            if (err) {
                                return next(err)
                            }
                            req.session.loggedIn = true;
                            req.session.uId = profile.id;

                            res.status(200).send(profile);
                        })

                    } else {
                        userProfHelper.createNewProfile(options, function (err, profile) {
                            if (err) {
                                return next(err)
                            }
                            req.session.loggedIn = true;
                            req.session.uId = profile[0].id;

                            res.status(201).send(profile[0]);
                        })
                    }
                })

            } else if (KNOWN_FB_USER) {
                userProfHelper.updateUser(uid, options, function (err) {
                    if (err) {
                        return next(err)
                    }

                    userProfHelper.enterGuest(options, function (err, profile) {
                        if (err) {
                            return next(err)
                        }
                        req.session.loggedIn = true;
                        req.session.uId = profile.id;

                        res.status(200).send(profile);
                    })

                })
            }
            else {
                userProfHelper.getExistingUser(options, function (err, profile) {

                    if (err) {
                        return next(err)
                    }

                    if (profile[0] && profile[0].id) {
                        req.session.loggedIn = true;
                        req.session.uId = profile[0].id;

                        res.status(200).send(profile[0])

                    } else {
                        userProfHelper.createNewProfile(options, function (err, profile) {

                            if (err) {
                                return next(err)
                            }
                            req.session.loggedIn = true;
                            req.session.uId = profile[0].id;

                            res.status(201).send(profile[0]);
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
                                'insert into ' + TABLES.FRIENDS + ' (game_profile_id, friend_game_profile_id, updated_at, created_at) ' +
                                'select ' + uid + ' as g_id, g.id, ' + '\'' + curDate + '\'' + ' as updated_at, ' + '\'' + curDate + '\'' + ' as created_at from users_profile u ' +
                                'left join ' + TABLES.GAME_PROFILE + ' g on g.user_id = u.id ' +
                                'where facebook_id in ' + queryStr +
                                'and g.id not in (select friend_game_profile_id from ' + TABLES.FRIENDS + '  where game_profile_id = ' + uid + ')'
                            )
                            .exec(function (err) {
                                if (err) {
                                    cb(err)
                                } else {
                                    cb()
                                }
                            });
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
            .exec(function (err) {

                if (err) {
                    return next(err)
                }
                session.kill(req, res, next);
            })
    };

    this.getTopRankList = function (req, res, next) {
        var type = req.query.type;
        var uid = req.session.uId;

        if (type === CONSTANTS.FRIENDS) {
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
        } else {
            PostGre.knex(TABLES.USERS_PROFILE)
                .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
                .select('first_name', 'last_name', 'points_number')
                .orderBy('points_number', 'desc')
                .limit(25)
                .then(function (profiles) {
                    res.status(200).send(profiles)
                })
                .otherwise(next)
        }

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

};

module.exports = Users;

