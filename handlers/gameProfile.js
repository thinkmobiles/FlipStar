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

            if (!result.length) {
                err = new Error(RESPONSES.UNDEFINED_PLAYER);
                err.status = 500;
                return next(err);
            }

            responseObj = {
                flips: result[0].flips_number,
                points: result[0].points_number,
                stars: result[0].stars_number,
                coins: result[0].coins_number,
                boosters: []
            };

            for (var i = result.length; i--;) {
                responseObj.boosters.push({
                    booster: result[i].booster_id ? result[i].booster_id : -1,
                    activated: result[i].is_active ? result[i].is_active : -1,
                    remainder: result[i].flips_left ? result[i].flips_left : -1,
                    quantity: result[i].quantity ? result[i].quantity : -1
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
            .catch(function (err) {
                next(err)
            })
    };

    this.syncOfflineGame = function (req, res, next) {
        var options = req.body;
        var uid = options.uId;
        var games = options.games;
        var open = options.open;
        var buy = options.buy;
        var gameDate = new Date(options.date);
        var err;

                PostGre.knex(TABLES.GAME_PROFILE)
                    .where('id', uid)
                    .then(function (profile) {

                        if (profile[0].last_seen_date > gameDate) {

                            err = new Error(RESPONSES.OUTDATED);
                            err.status = 400;

                            return next(err);
                        }

                            async.series([

                                function (cb) {

                                    if (options.first_name) {
                                        userProfHelper.updateUser(uid, options, cb)

                                    } else {
                                        cb()
                                    }
                                },

                                function(cb) {

                                    if (games && games.length) {

                                        gameProfHelper.syncGames(options, function (err) {

                                            if(err) {
                                                return cb(err)
                                            }
                                            cb()
                                        })

                                    } else {
                                       cb()
                                    }
                                },

                                function (cb) {

                                    if (open && open.length) {

                                        gameProfHelper.syncOpenSmashes(uid, open, function (err) {

                                            if(err) {
                                                return cb(err)
                                            }
                                            cb()
                                        })

                                    } else {
                                        cb()
                                    }
                                },

                                function (cb) {

                                    if (buy && buy.length) {

                                        gameProfHelper.syncBoughtSmashes(uid, buy, function (err) {

                                            if(err) {
                                                return cb(err)
                                            }
                                            cb()
                                        })

                                    } else {
                                        cb()
                                    }
                                }

                            ], function (err) {

                                if (err) {
                                    return next(err)
                                }

                                gameProfHelper.calculatePoints(uid, function (err) {

                                    if (err) {
                                        return next(err)
                                    }

                                    req.session.loggedIn = true;
                                    req.session.uId = uid;

                                    res.status(200).send({
                                        success: RESPONSES.SYNCRONIZED
                                    })
                                })
                            })

                    })
                    .catch(function (err) {
                        next(err)
                    })


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
                    responseObj.boosters.push({booster_id: profile.rows[i].boosters ? profile.rows[i].boosters : 0, flips_left: profile.rows[i].left_flips ? profile.rows[i].left_flips : 0});
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

        function openOrBuyCallback (err) {
            var response;

            if (err) {
                return next(err)
            }

            options.action ? response = {success: RESPONSES.BUY_SMASHES} : response = {success: RESPONSES.OPEN_SMASHES};

            res.status(200).send(response)
        }

        if (!options || typeof options.action !== 'number' || typeof options.smash_id !== 'number') {

            err = new Error(RESPONSES.INVALID_PARAMETERS);
            err.status = 400;
            return next(err);

        }

        data = {
            uid: uid,
            smash_id: options.smash_id,
            currency: CONSTANTS.CURRENCY_TYPE.SOFT
        };

        options.action ? gameProfHelper.buySmashes(data, openOrBuyCallback) : gameProfHelper.openSmashes(data, openOrBuyCallback);
    };

    this.addFlips = function (req, res, next) {
        var uid = req.session.uId;

        gameProfHelper.addFlips(uid, 0, function (err) {

            if (err) {
                return next(err)
            }

            res.status(200).send({
                success: RESPONSES.FLIPS_ADDED
            })
        });
    };
};

module.exports = GameProfile;

