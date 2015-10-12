/**
 * @description Game profile management module
 * @module gameProfile
 *
 */

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
        /**
         * __Type__ `GET`
         * __Content-Type__ `application/json`
         *
         * This __method__ allows get _gameProfile_
         *
         * @example Request example:
         *         http://192.168.88.110:8899/gameProfile/:id
         *
         * @example Response example:
         *
         * {
         *       "flips": 50,
         *       "points": 8768,
         *       "stars": 8600,
         *       "boosters": [
         *           {
         *               "booster": 1,
         *               "activated": true,
         *               "remainder": 100,
         *               "quantity": 0
         *           }
         *       ]
         *   }
         *
         * @param {number} id - id of Game Profile
         * @method getProfileById
         * @instance
         */

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
                    activated: result[i].is_active ? result[i].is_active : false,
                    remainder: result[i].flips_left ? result[i].flips_left : -1,
                    quantity: result[i].quantity || result[i].quantity === 0 ? result[i].quantity : -1
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
        /**
         * __Type__ `GET`
         * __Content-Type__ `application/json`
         *
         * This __method__ allows get _collection of users smashes_
         *
         * @example Request example:
         *         http://192.168.88.110:8899/gameProfile/collection
         *
         * @example Response example:
         *
         * [
         *    {
         *        "smash_id": 12,
         *        "quantity": 8,
         *        "is_open": true
         *    },
         *    {
         *        "smash_id": 5,
         *        "quantity": 5,
         *        "is_open": true
         *    }
         * ]
         *
         * @method getMyCollection
         * @instance
         */
      var uid = req.session.uId;

        PostGre.knex(TABLES.USERS_SMASHES)
            .leftJoin(TABLES.GAME_PROFILE, TABLES.GAME_PROFILE + '.id', TABLES.USERS_SMASHES + '.game_profile_id' )
            .where('uuid', uid)
            .select('smash_id', 'quantity', 'is_open')
            .then(function (collection) {
                res.status(200).send(collection)
            })
            .catch(function (err) {
                next(err)
            })
    };

    this.syncOfflineGame = function (req, res, next) {
        /**
         * __Type__ `POST`
         * __Content-Type__ `application/json`
         *
         * This __method__ allows synchronize offline changes
         *
         * @example Request example:
         *         http://192.168.88.110:8899/gameProfile/sync
         *
         * @example Response example:
         *
         * {
         *     "uId": 7,
         *     "first_name": "John",
         *     "date": "Tue Sep 01 2015 15:30:35 GMT+0300 (EEST)",
         *     "games": [{"stars": 100, "boosters_id": [1,2,3]}, {"stars": 100, "boosters_id": [1,2,3]}],
         *     "open": [10,5,4],
         *     "buy": [10,5,4,1,12]
         * }
         * @param {number} uId - id of Game Profile
         * @param {string} first_name - users first name (optional)
         * @param {string} date - date of last changes
         * @param {array} games - list of games (optional)
         * @param {number} stars - quantity of won stars
         * @param {array} boosters_id - list of used boosters (optional)
         * @param {array} open - list of open smashes (optional)
         * @param {array} buy - list of buy smashes (optional)
         * @method syncOfflineGame
         * @instance
         */
        var options = req.body;
        var uid = options.uId;
        var buy = options.buy;
        var gameDate = new Date(options.date);
        var curDate = new Date();
        var err;

        /*PostGre.knex
            .raw(
            'SELECT   gp.last_seen_date < TIMESTAMP \'' + gameDate + '\' AND  ' +
            'TIMESTAMP \'' + gameDate + '\' < \'' + curDate.toISOString() + '\' ' +
            'FROM game_profile  gp ' +
            'WHERE gp.id = ' + uid + '; '
        )*/

                PostGre.knex(TABLES.GAME_PROFILE)
                        .where('uuid', uid)
                    .then(function (profile/*queryResult*/) {

                        if (profile[0].last_seen_date > gameDate && gameDate < curDate) {
                        //if (!queryResult.rows[0]['?column?']) {

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
                                    gameProfHelper.syncGames(options, cb)
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

                                req.session.loggedIn = true;
                                req.session.uId = uid;

                                res.status(200).send({
                                    success: RESPONSES.SYNCRONIZED
                                })

                               /* gameProfHelper.calculatePoints(uid, function (err) {

                                    if (err) {
                                        return next(err)
                                    }


                                })*/
                            })

                    })
                    .catch(function (err) {
                        next(err)
                    })


    };

    this.singleGame = function (req, res, next) {
        /**
         * __Type__ `POST`
         * __Content-Type__ `application/json`
         *
         * This __method__ allows _set_ won _stars_ in single player mode _to Game Profile_
         *
         * @example Request example:
         *         http://192.168.88.110:8899/gameProfile/game
         *
         * {
         *      "stars": 500
         * }
         * @example Response example:
         *
         * {
         *       "flips": 50,
         *       "points": 8768,
         *       "stars": 8600,
         *       "boosters": [
         *           {
         *               "booster": 1,
         *               "activated": true,
         *               "remainder": 100,
         *               "quantity": 0
         *           }
         *       ]
         *   }
         * @param {number} stars - quantity of won stars
         * @method singleGame
         * @instance
         */
        var options = req.body;
        var uid = req.session.uId;
        var responseObj;

        PostGre.knex
            .raw(
                'SELECT * FROM game(\'' + uid + '\', ' + options.stars + ');'
            )
            .then(function (profile) {
                responseObj = {
                    flips: profile.rows[0].flips,
                    stars: profile.rows[0].stars_quantity,
                    points: profile.rows[0].point,
                    boosters: []
                };

                for (var i = profile.rows.length; i--;) {
                    responseObj.boosters.push({booster_id: profile.rows[i].boosters ? profile.rows[i].boosters : 0, remainder: profile.rows[i].left_flips ? profile.rows[i].left_flips : 0});
                }

                res.status(200).send(responseObj)
            })
            .catch(function (err) {
                next(err)

            })
    };

    this.activateBooster = function (req, res, next) {
        /**
         * __Type__ `GET`
         * __Content-Type__ `application/json`
         *
         * This __method__ allows _activate_ users _boosters_
         *
         * @example Request example:
         *         http://192.168.88.110:8899/gameProfile/booster/:id
         *
         * @example Response example:
         *
         * {
         *     "booster": 1,
         *     "remainder": 195
         * }
         *
         * @param {number} id - id of booster
         * @method activateBooster
         * @instance
         */
        var uid = req.session.uId;
        var boosterId = req.params.id;

        PostGre.knex
            .raw(
                'SELECT * FROM activate_booster(' + uid + ', ' + boosterId + ');'
            )
            .then(function (booster) {
                res.status(200).send({
                    booster: booster.rows[0].id,
                    remainder:  booster.rows[0].flips
                })
            })
            .catch(function (err) {
                next(err)
            })
    };

    this.buySmashes = function (req, res, next) {
        /**
         * __Type__ `POST`
         * __Content-Type__ `application/json`
         *
         * This __method__ allows _open or buy smashes_
         *
         * @example Request example:
         *         http://192.168.88.110:8899/gameProfile/smash
         *
         * {
         *   "uId": 7,
         *   "action": 0,
         *   "smash_id": 12
         * }
         * @example Response example:
         *
         *
         * {
         *    "success": "Successfully opened"
         * }
         *
         *
         * @param {number} uId - id of Game Profile
         * @param {number} action - 0 - open, 1 - buy
         * @param {number} smash_id - id of smash
         * @method openOrBuySmashes
         * @instance
         */
        var options = req.body;
        var uid = req.session.uId;
        var err;
        var data;

        if (!options) {

            err = new Error(RESPONSES.INVALID_PARAMETERS);
            err.status = 400;
            return next(err);

        }

        data = {
            uid: uid,
            smash_id: options.smash_id,
            currency: CONSTANTS.CURRENCY_TYPE.SOFT
        };

        gameProfHelper.buySmashes(data, function (err, profile) {

            if (err) {
                return next(err);
            }

            res.status(200).send(profile);
        });
    };

    this.addFlips = function (req, res, next) {
        /**
         * __Type__ `POST`
         * __Content-Type__ `application/json`
         *
         * This __method__ allows add _flips_
         *
         * @example Request example:
         *         http://192.168.88.110:8899/gameProfile/flip
         *
         * {
         *   "flips": 7
         * }
         * @example Response example:
         *
         * {
         *    "success": "Successfully flips added"
         * }
         *
         *
         * @param {number} flips - quantity of flips
         * @method addFlips
         * @instance
         */
        var data = {
            uid: req.session.uId,
            quantity: req.body.flips,
            actionType: CONSTANTS.FLIPS_ACTION.TIMER
        };

        gameProfHelper.addFlips(data, function (err) {

            if (err) {
                return next(err)
            }

            res.status(200).send({
                success: RESPONSES.FLIPS_ADDED
            })
        });
    };

    this.addAchievement = function (req, res, next) {
        var options = req.body;
        var error;

       if (!options && !options.name) {
           error = new Error(RESPONSES.INVALID_PARAMETERS);
           error.status = 400;

           return next(error);
       }

        gameProfHelper.achievementsTrigger({
            uuid:  req.session.uId,
            name: options.name
        }, function (err) {

            if (err) {
                return next(err)
            }

            res.status(200).send({
                success: RESPONSES.CREATED
            })
        })
    };
};

module.exports = GameProfile;

