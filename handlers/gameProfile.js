var RESPONSES = require('../constants/responseMessages');
var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
var async = require('async');
var _ = require('lodash');
var Session = require('./sessions');
var Users;

GameProfile = function (PostGre) {
    var UserModel = PostGre.Models[MODELS.USERS_PROFILE];
    var DeviceModel = PostGre.Models[MODELS.DEVICE];
    var GameProfileModel = PostGre.Models[MODELS.GAME_PROFILE];
    var session = new Session(PostGre);

    function prepareGameProfSaveInfo (options) {
        var result = {};
        var key;
        var value;

        for (key in options) {
            value = options[key];

            switch (key) {
                case 'app_platform':
                    result[key] = value;
                    break;
                case 'sessions_number':
                    result[key] = value;
                    break;
                case 'session_max_length':
                    result[key] = value;
                    break;
                case 'stars_number':
                    result[key] = value;
                    break;
                case 'points_number':
                    result[key] = value;
                    break;
                case 'pogs_number':
                    result[key] = value;
                    break;
                case 'flips_number':
                    result[key] = value;
                    break;
                case 'app_flyer_source':
                    result[key] = value;
                    break;
                case 'app_flyer_media':
                    result[key] = value;
                    break;
                case 'app_flyer_campaign':
                    result[key] = value;
                    break;
                case 'utm_source':
                    result[key] = value;
                    break;
                case 'last_login_country':
                    result[key] = value;
                    break;
                case 'real_spent':
                    result[key] = value;
                    break;
                case 'soft_currency_spent':
                    result[key] = value;
                    break;
                case 'flips_spent':
                    result[key] = value;
                    break;
                case 'fb_friends_number':
                    result[key] = value;
                    break;
                case 'shares':
                    result[key] = value;
                    break;
                case 'tools_used':
                    result[key] = value;
                    break;
                case 'offers_seen':
                    result[key] = value;
                    break;
                case 'offers_bought':
                    result[key] = value;
                    break;
                case 'promo_seen':
                    result[key] = value;
                    break;

            }

        }
        result.last_seen_date = new Date();
        return result;
    };

    function addSmashes (profile, smashes, callback) {
        var insertObj = [];
        var queryStr = '';
        var price = 0;

        for (var i = smashes.length; i--;) {
            queryStr += '\'' + smashes[i] + '\'' + ','
        }

        queryStr = queryStr.slice(0, -1);
        queryStr ='('  + queryStr + ')';

        async.waterfall([
            function (cb) {
                PostGre.knex
                    .raw(
                        'select s.id, sum(set*100) as price from smashes s ' +
                        'where id in ' + queryStr + ' and id not in (select s.id from smashes s ' +
                        'left join users_smashes us on s.id = us.smash_id ' +
                        'where game_profile_id = ' + profile.id + ')' +
                        'group by s.id'
                    )
                    .then(function (result) {
                        cb(null, result.rows)
                    })
                    .otherwise(cb)
            },
            function (data, cb) {
                for (var i = data.length; i--;) {
                    insertObj.push({
                        game_profile_id: profile.id,
                        smash_id: data[i].id,
                        quantity: 0,
                        updated_at: new Date(),
                        created_at: new Date()
                    });
                    price += parseInt(data[i].price);
                }

                if (price < profile.stars_number) {
                            profile.stars_number = profile.stars_number - price;

                            if (insertObj.length) {
                                PostGre.knex(TABLES.USERS_SMASHES)
                                    .insert(insertObj)
                                    .exec(cb)
                            } else {
                                cb()
                            }
                } else {
                    cb()
                }
            }
        ], function (err) {
            if (err) {
                return callback(err)
            }

                PostGre.knex(TABLES.GAME_PROFILE)
                    .where('id', profile.id)
                    .update(profile)
                    .exec(callback)


        })
    };

    function calculatePoints (uid, callback) {
        PostGre.knex
            .raw(
                'update game_profile ' +
                'set points_number = (select sum(quantity)*sum(distinct set) + min(stars_number) as points_number from game_profile gp ' +
                'left join users_smashes us on us.game_profile_id = gp.id ' +
                'left join smashes s on us.smash_id = s.id ' +
                'where gp.id = ' + uid + ') ' +
                'where id = ' + uid
            )
            .exec(callback)
    };

    this.getProfileById = function (req, res, next) {
        var uid = req.params.id;

        PostGre.knex(TABLES.USERS_PROFILE)
            .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
            .leftJoin(TABLES.USERS_SMASHES, TABLES.GAME_PROFILE + '.id', TABLES.USERS_SMASHES + '.game_profile_id')
            .where(TABLES.GAME_PROFILE + '.id', uid)
            .select('first_name', 'last_name', 'stars_number', 'points_number', 'pogs_number', 'flips_number', 'last_seen_date')
            .then(function (profile) {
                res.status(200).send(profile[0])
            })
            .otherwise(next)
    };

    this.updateProfile = function (req, res, next) {
        var uid = req.params.id;
        var options = req.body;
        var updatedObj = prepareGameProfSaveInfo(options);

        GameProfileModel
            .forge({
                id: uid
            })
            .save(
            updatedObj,
            {
                patch: true
            })
            .then(function () {
                res.status(200).send({
                    success: RESPONSES.UPDATED
                })
            })
            .otherwise(next)
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
                                        addSmashes(profile, openSmashes, cb);
                                    } else {
                                        cb();
                                    }
                                }

                            ], function (err) {
                                if (err) {
                                    return next(err)
                                }
                                calculatePoints(uid, function (err) {
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

