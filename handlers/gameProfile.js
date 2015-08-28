var RESPONSES = require('../constants/responseMessages');
var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
var CONSTANTS = require('../constants/constants');
var async = require('async');
var _ = require('lodash');
var Session = require('./sessions');
var GameProfHelper = require('../helpers/gameProfile');
var UserProfHelper = require('../helpers/userProfile');
var Users;

GameProfile = function (PostGre) {
    var gameProfHelper = new GameProfHelper(PostGre);
    var userProfHelper = new UserProfHelper(PostGre);

    this.getProfileById = function (req, res, next) {
        var uid = req.params.id;
        var responseObj;

        gameProfHelper.getProfileById(uid, function (err, result) {
            if (err) {
                return next(err)
            }
            responseObj = {
                flips: result[0].flips_number,
                points: result[0].points_number,
                stars: result[0].stars_number,
                boosters: []
            };

            for (var i = result.length; i--;) {
                responseObj.boosters.push({
                    booster: result[i].booster_id,
                    activated: result[i].is_active,
                    remainder: result[i].flips_left,
                    quantity: result[i].quantity
                })
            }
            res.status(200).send(responseObj)
        })
    };

    this.updateProfile = function (req, res, next) {
        var uid = req.params.id;
        var options = req.body;

        gameProfHelper.updateProfile(uid, options, function (err, result) {
            if (err) {
                return next(err)
            }
            res.status(200).send({
                success: RESPONSES.UPDATED
            })
        })
    };

    this.getMyCollection = function (req, res, next) {
      var uid = req.session.uId;

        PostGre.knex(TABLES.USERS_SMASHES)
            .where('game_profile_id', uid)
            .select('smash_id', 'quantity', 'is_open')
            .then(function (collection) {
                res.status(200).send(collection)
            })
            .otherwise(next)
    };

    this.syncOfflineGame = function (req, res, next) {
        var options = req.body;
        var uid = options.uId;
        var games = options.games;
        var curDate = new Date();
        var gameDate = new Date(options.date);
        var updProf = {};
        var maxFlips;
        var err;
        var gamesLength;

                PostGre.knex(TABLES.GAME_PROFILE)
                    .where('id', uid)
                    .then(function (profile) {

                        if (profile[0].last_seen_date > gameDate) {
                            err = new Error(RESPONSES.OUTDATED);
                            err.status = 400;
                            next(err);
                        } else {
                            async.waterfall([
                                function (cb) {
                                    if (options.first_name) {
                                        userProfHelper.updateUser(uid, options, cb)
                                    } else {
                                        cb()
                                    }
                                },

                                function(user, cb) {
                                    if (games && games.length) {
                                        updProf.last_seen_date = new Date();
                                        updProf.id = profile[0].id;
                                        updProf.stars_number = profile[0].stars_number;
                                        updProf.points_number = profile[0].points_number;

                                        maxFlips = parseInt((gameDate - profile[0].last_seen_date)/(1000*60*60)) * 5 + profile[0].flips_number;

                                        games = games.slice(0, maxFlips);
                                        gamesLength = games.length;
                                        updProf.flips_number = maxFlips - gamesLength;

                                        for (var i = gamesLength; i--;) {
                                            updProf.stars_number += games[i];
                                            updProf.points_number += games[i];
                                        }

                                        updProf.flips_number = (profile[0].flips_number <= 50 && updProf.flips_number > 50) ? 50 : updProf.flips_number;

                                        cb(null, updProf);

                                    } else {
                                       cb()
                                    }
                                }

                            ], function (err) {
                                if (err) {
                                    return next(err)
                                }
                                PostGre.knex(TABLES.GAME_PROFILE)
                                    .where('id', uid)
                                    .update(updProf)
                                    .then(function () {
                                        req.session.loggedIn = true;
                                        req.session.uId = uid;

                                        res.status(200).send({
                                            success: RESPONSES.SYNCRONIZED
                                        })
                                    })
                                    .catch(function (err) {
                                        next(err)
                                    })
                            })

                        }

                    })
                    .otherwise(next)


    };

    this.singleGame = function (req, res, next) {
        var options = req.body;
        var uid = req.session.uId;
        var responseObj;

        PostGre.knex
            .raw(
                'SELECT * FROM game(' + uid + ', ' + options.stars + ');'
            )
            .then(function (profile) {
                responseObj = {
                    flips: profile.rows[0].flips,
                    stars: profile.rows[0].stars_quantity,
                    points: profile.rows[0].point,
                    boosters: []
                };
                for (var i = profile.rows.length; i--;) {
                    responseObj.boosters.push({booster_id: profile.rows[i].boosters, flips_left: profile.rows[i].left_flips ? profile.rows[i].left_flips : 0});
                }

                res.status(200).send(responseObj)
            })
            .catch(function (err) {
                next(err)

            })
    };

    this.activateBooster = function (req, res, next) {
        var uid = req.session.uId;
        var boosterId = req.params.id;

        PostGre.knex
            .raw(
                'SELECT * FROM activate_booster(' + uid + ', ' + boosterId + ');'
            )
            .then(function (booster) {
                res.status(200).send({
                    booster: booster.rows[0].id,
                    flips_left:  booster.rows[0].flips
                })
            })
            .catch(function (err) {
                next(err)
            })
    };

    this.openOrBuySmashes = function (req, res, next) {
        var options = req.body;
        var uid = req.session.uId;
        var err;
        var data;

        function openCallback (err) {
            if (err) {
                return next(err)
            }
            res.status(200).send({
                success: RESPONSES.OPEN_SMASHES
            })
        }

        function buyCallback (err) {
            if (err) {
                return next(err)
            }
            res.status(200).send({
                success: RESPONSES.BUY_SMASHES
            })
        }

        if (options && options.hasOwnProperty('action') && options.hasOwnProperty('smash_id')) {

            data = {
                uid: uid,
                smash_id: options.smash_id,
                currency: CONSTANTS.CURRENCY_TYPE.SOFT
            };

            options.action ? gameProfHelper.buySmashes(data, buyCallback) : gameProfHelper.openSmashes(data, openCallback);

        } else {
            err = new Error(RESPONSES.INVALID_PARAMETERS);
            err.status = 400;
            next(err)
        }
    };
};

module.exports = GameProfile;

