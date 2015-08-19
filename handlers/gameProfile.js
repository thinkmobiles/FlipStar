var RESPONSES = require('../constants/responseMessages');
var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
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

        gameProfHelper.getProfileById(uid, function (err, result) {
            if (err) {
                return next(err)
            }
            res.status(200).send(result[0])
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
            .select('smash_id', 'quantity')
            .then(function (collection) {
                res.status(200).send(collection)
            })
            .otherwise(next)
    };

    this.syncOfflineGame = function (req, res, next) {
        var options = req.body;
        var uid = req. session.uId;
        var games = options.games;
        var openSmashes = options.smashes;
        var user = options.user;
        var gameDate = new Date(options.date);
        var updProf = {};
        var err;

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
                                    if (user) {
                                        userProfHelper.updateUser(uid, user, cb)
                                    } else {
                                        cb()
                                    }
                                },

                                function(cb) {
                                    if (games && games.length) {
                                        updProf.last_seen_date = new Date();
                                        updProf.id = profile[0].id;
                                        updProf.stars_number = profile[0].stars_number;
                                        updProf.flips_number = profile[0].flips_number;

                                        games = games.slice(0, profile[0].flips_number);

                                        for (var i = games.length; i--;) {
                                            updProf.stars_number += games[i];
                                            updProf.flips_number--;
                                        }
                                        cb(null, updProf);

                                    } else {
                                       cb()
                                    }
                                },

                                function (profile, cb) {
                                    if (openSmashes && openSmashes.length) {
                                        gameProfHelper.openSmashes(profile, openSmashes, cb);
                                    } else {
                                        cb();
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
                                    res.status(200).send({
                                        success: RESPONSES.SYNCRONIZED
                                    })
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
                    responseObj.boosters.push({booster_id: profile.rows[i].boosters, flips_left: profile.rows[i].left_flips});
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

   /* this.addSmashes = function (req, res, next) {
        var options = req.body;
        var uid = options.uid;
        var smashesId = _.pluck(options.smashes, 'id');
        var quantities = _.pluck(options.smashes, 'quantity');
        var curDate = new Date();
        var insertObj;

        async.eachSeries(smashesId, function (smash, cb){
            insertObj = {
                game_profile_id: uid,
                smash_id: smash,
                quantity: quantities[smashesId.indexOf(smash)],
                updated_at: curDate,
                created_at: curDate
            };


            PostGre.knex
                .raw(
                    'update users_smashes set updated_at = now(), quantity = quantity + ' + '\'' + quantities[smashesId.indexOf(smash)] + '\' '+
                    'where game_profile_id = ' + uid + ' and smash_id = ' + smash +
                    'returning users_smashes.id'
                )
                .then(function (result) {
                    if (result.rows.length) {
                        cb()
                    } else {
                        PostGre.knex(TABLES.USERS_SMASHES)
                            .insert(insertObj)
                            .exec(cb)
                    }
                })
                .otherwise(cb)
        }, function (err) {
            if (err) {
                return next(err)
            }
            res.status(200).send({success: RESPONSES.UPDATED})
        })
    };*/

};

module.exports = GameProfile;

