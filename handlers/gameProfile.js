var RESPONSES = require('../constants/responseMessages');
var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
var async = require('async');
var _ = require('lodash');
var Session = require('./sessions');
var GameProfHelper = require('../helpers/gameProfile');
var Users;

GameProfile = function (PostGre) {
    var gameProfHelper = new GameProfHelper(PostGre);
    var UserModel = PostGre.Models[MODELS.USERS_PROFILE];
    var DeviceModel = PostGre.Models[MODELS.DEVICE];
    var GameProfileModel = PostGre.Models[MODELS.GAME_PROFILE];
    var session = new Session(PostGre);

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
                                        gameProfHelper.addSmashes(profile, openSmashes, cb);
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

};

module.exports = GameProfile;

