var RESPONSES = require('../constants/responseMessages');
var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
var GROUPS = require('../constants/FbNotificationGroup');
var async = require('async');
var _ = require('underscore');
var Session = require('./sessions');
var GameProfHelper = require('../helpers/gameProfile');
var UserProfHelper = require('../helpers/userProfile');
//var FBHelper = require('../helpers/FBnotifications');
var Users;

Users = function (PostGre) {
    var gameProfHelper = new GameProfHelper(PostGre);
    var userProfHelper = new UserProfHelper(PostGre);
    //var fbHelper = new FBHelper(PostGre);
    var session = new Session(PostGre);

    this.signIn = function (req, res, next) {
        var options = req.body;
        var err;

        if (options && options.device_id) {
            if (options.uId && !options.facebook_id) {
                userProfHelper.enterGuest(options, function (err, profile) {
                    if (err) {
                        return next(err)
                    }
                    req.session.loggedIn = true;
                    req.session.uId = profile.id;

                    res.status(200).send(profile);
                })
            } else if (options.facebook_id && !options.uId) {
                userProfHelper.isExistingFBUser(options.facebook_id, function (err, result) {
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

            } else if (options.uId && options.facebook_id) {
                userProfHelper.updateUser(options.uId, options, function (err, profile) {
                    if (err) {
                        return next(err)
                    }
                    req.session.loggedIn = true;
                    req.session.uId = profile.id;

                    PostGre.knex(TABLES.GAME_PROFILE)
                        .select('*',TABLES.GAME_PROFILE + '.id' + ' as id')
                        .leftJoin(TABLES.USERS_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
                        .where(TABLES.GAME_PROFILE + '.id', options.uId)
                        .then(function (profile) {
                            res.status(200).send(profile[0]);
                        })
                        .otherwise(next)

                })
            } else {
                PostGre.knex(TABLES.GAME_PROFILE)
                    .select('*',TABLES.GAME_PROFILE + '.id' + ' as id')
                    .leftJoin(TABLES.USERS_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
                    .leftJoin(TABLES.DEVICE, TABLES.GAME_PROFILE + '.device_id', TABLES.DEVICE + '.id')
                    .where(function () {
                        this.where(TABLES.DEVICE + '.device_id', options.device_id)
                            .andWhere(TABLES.USERS_PROFILE + '.facebook_id', '=', null)
                    })
                    .then(function (profile) {
                        if (profile[0] && profile[0].id) {
                            res.status(200).send(profile[0])
                        } else {
                            userProfHelper.createNewProfile(options, function (err, profile) {
                                if (err) {
                                    return next(err)
                                }
                                req.session.loggedIn = true;
                                req.session.uId = profile.id;

                                res.status(201).send(profile[0]);
                            })
                        }
                    })
                    .otherwise(next)

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
        var err;

        if (options && deviceId && uid) {

            if (options.facebook_id) {

                PostGre.knex(TABLES.USERS_PROFILE)
                    .select(TABLES.GAME_PROFILE + '.id', TABLES.USERS_PROFILE + '.facebook_id', TABLES.DEVICE + '.device_id')
                    .where('facebook_id', options.facebook_id)
                    .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
                    .leftJoin(TABLES.DEVICE, TABLES.GAME_PROFILE + '.device_id', TABLES.DEVICE + '.id')
                    .then(function (result) {

                        if (result[0]) {
                                session.register(req, res, result[0])

                        } else {
                            userProfHelper.updateUser(uid, options, function (err, result) {
                                if (err) {
                                    return next(err)
                                }
                                session.register(req, res, result)
                            })
                        }
                    })
                    .otherwise(next)
            } else {
                userProfHelper.updateUser(uid, options, function (err, result) {

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
        session.kill(req, res, next);
    };

    this.getTopRankList = function (req, res, next) {
        var type = req.query.type;
        var uid = req.session.uId;

        if (type === 'friends') {
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

};

module.exports = Users;

