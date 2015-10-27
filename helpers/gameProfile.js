var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
var CONSTANTS = require('../constants/constants');
var RESPONSES = require('../constants/responseMessages');
var async = require('async');
var _ = require('lodash');
var Session = require('../handlers/sessions');
var Users;

GameProfile = function (PostGre) {
    var GameProfileModel = PostGre.Models[MODELS.GAME_PROFILE];
    var self = this;

    function prepareGameProfSaveInfo(options) {
        var gameProfile = {};
        var value = [
            'app_platform',
            'sessions_number',
            'session_max_length',
            'stars_number',
            'points_number',
            'pogs_number',
            'flips_number',
            'app_flyer_source',
            'app_flyer_media',
            'app_flyer_campaign',
            'utm_source',
            'last_login_country',
            'real_spent',
            'soft_currency_spent',
            'flips_spent',
            'fb_friends_number',
            'shares',
            'tools_used',
            'offers_seen',
            'offers_bought',
            'promo_seen'
        ];

        for (var i = value.length; i--;) {

            gameProfile[value[i]] = options[value[i]] ? options[value[i]] : null;
        }

        gameProfile.last_seen_date = new Date();

        return gameProfile;
    }

    this.getProfileById = function (uid, callback) {

        PostGre.knex(TABLES.USERS_PROFILE)
            .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
            .leftJoin(TABLES.USERS_BOOSTERS, TABLES.GAME_PROFILE + '.id', TABLES.USERS_BOOSTERS + '.game_profile_id')
            .where(TABLES.GAME_PROFILE + '.uuid', uid)
            .select('stars_number', 'points_number', 'flips_number', 'booster_id', 'flips_left', 'is_active', TABLES.USERS_BOOSTERS + '.quantity')
            .then(function (result) {
                callback(null, result)
            })
            .catch(function (err) {
                callback(err)
            })
    };

    this.updateProfile = function (uid, options, callback) {
        var updatedObj = prepareGameProfSaveInfo(options);

        GameProfileModel
            .forge({
                uuid: uid
            })
            .save(
            updatedObj,
            {
                patch: true
            }
        )
            .then(function () {
                callback()
            })
            .catch(function (err) {
                callback(err)
            })
    };

    this.syncGames = function (options, callback) {
        var uid = options.uId;
        var curDate = new Date();
        var gameList = options.games;
        var games = _.pluck(gameList, 'stars') || [];
        var boosters = _.flatten(_.pluck(gameList, 'boosters_id'));
        var updProf = {};
        var maxFlips;
        var gamesLength;

        PostGre.knex(TABLES.GAME_PROFILE)
            .where('uuid', uid)
            .then(function (profile) {

                updProf.last_seen_date = curDate.toISOString();
                updProf.id = profile[0].id;
                updProf.stars_number = profile[0].stars_number;

                maxFlips = parseInt((curDate.getTime() - profile[0].last_seen_date.getTime() ) / (1000 * 60 * 60)) * CONSTANTS.FLIPS_PER_HOUR + profile[0].flips_number;
                updProf.flips_number = maxFlips;

                games = games.slice(0, maxFlips);
                gamesLength = games.length;

                for (var i = gamesLength; i--;) {
                    updProf.stars_number += games[i];
                }

                updProf.flips_number = (profile[0].flips_number <= 50 && maxFlips > 50) ? 50 : maxFlips - gamesLength;

                async.each(boosters, function (booster, cb) {

                    PostGre.knex
                        .raw(
                        'UPDATE :users_boosters: SET is_active = true, flips_left = flips_left - 1 ' +
                        'WHERE game_profile_id = :gid AND booster_id = :booster',
                        {
                            booster: booster,
                            users_boosters: TABLES.USERS_BOOSTERS,
                            gid: updProf.id
                        }
                    )
                        .then(function () {
                            cb();
                        })
                        .catch(function (err) {
                            cb(err);
                        })

                }, function (err) {

                    if (err) {
                        return callback(err);
                    }

                    PostGre.knex(TABLES.GAME_PROFILE)
                        .where('uuid', uid)
                        .update(updProf)
                        .then(function () {
                            callback();
                        })
                        .catch(function (err) {
                            callback(err);
                        })
                })

            })
            .catch(function (err) {
                callback(err);
            })
    };

    this.syncBoughtSmashes = function (uid, smashes, callback) {
        var setId;
        var price;
        var totalPrice = 0;
        var setSize = CONSTANTS.SMASHES_PER_SET;
        var achievement = CONSTANTS.ACHIEVEMENTS.SMASH_UNLOCK.NAME;
        var updProf = {
            last_seen_date: new Date().toISOString()
        };


        async.series([

            function (cb) {
                PostGre.knex(TABLES.GAME_PROFILE)
                    .where('uuid', uid)
                    .then(function (profile) {

                        for (var i = smashes.length; i--;) {
                            (smashes[i] % setSize) ? setId = 1 + (smashes[i] / setSize) | 0 : setId = (smashes[i] / setSize) | 0;
                            price = setId * CONSTANTS.SMASH_DEFAULT_PRICE;

                            totalPrice += price;
                        }

                        if (profile[0].stars_number - totalPrice < 0) {
                            return callback();
                        }
                        updProf.stars_number = profile[0].stars_number - totalPrice;

                        cb();
                    })
                    .catch(cb)
            },

            function (cb) {
                PostGre.knex
                    .raw('SELECT add_smashes(?, ?);',
                    [uid, smashes]
                    )
                    .then(function () {
                        cb();
                    })
                    .catch(cb)
            },

            function (cb) {
                async.eachSeries(smashes, function (smashId, esCb) {
                    setId = (smashId % setSize) ? 1 + (smashId / setSize) | 0 : (smashId / setSize) | 0;

                    self.achievementsTrigger({
                        uuid: uid,
                        name: achievement,
                        set: setId,
                        item: smashId

                    }, esCb)

                }, cb);
            },

            function (cb) {
                PostGre.knex(TABLES.GAME_PROFILE)
                    .where('uuid', uid)
                    .update(updProf)
                    .then(function () {
                        cb();
                    })
                    .catch(cb)
            }

        ], function (err) {

            if (err) {
                return callback(err);
            }

            callback();
        })
    };

    this.syncAchievements = function (options, callback) {
        var achievementList = options.achievement;
        var achName = CONSTANTS.ACHIEVEMENTS.SET_UNLOCK.NAME;

        async.eachSeries(achievementList, function (achievement, cb) {
            achievement.name !== achName
                ? cb()
                : self.achievementsTrigger({
                uuid: options.uId,
                name: achievement.name,
                set: achievement.set,
                item: achievement.item

            }, cb);

        }, callback)
    };

    this.addSmashes = function (options, callback) {
        var uid = options.uid;
        var smashesIds = options.smashes;
        var setSize = CONSTANTS.SMASHES_PER_SET;
        var achievement = CONSTANTS.ACHIEVEMENTS.SMASH_UNLOCK.NAME;
        var setId;

        PostGre.knex
            .raw('SELECT add_smashes(?, ?);',
            [uid, smashesIds]
            )
            .then(function () {

                async.eachSeries(smashesIds, function (smashId, cb) {
                    setId = (smashId % setSize) ? 1 + (smashId / setSize) | 0 : (smashId / setSize) | 0;

                    self.achievementsTrigger({
                        uuid: uid,
                        name: achievement,
                        set: setId,
                        item: smashId

                    }, cb)

                }, callback);
            })
            .catch(callback)

    };

    this.removeSmashes = function (options, callback) {
        var uid = options.uid;
        var smashesIds = options.smashes;

        async.series([

            function (cb) {
                PostGre.knex
                    .raw('SELECT remove_smashes(?, ?);',
                    [uid, smashesIds]
                    )
                    .then(function () {
                        cb();
                    })
                    .catch(cb)
            },

            function (cb) {
                PostGre.knex
                    .raw('SELECT calc_game_rate(?);',
                    [uid]
                    )
                    .then(function () {
                        cb();
                    })
                    .catch(cb)
            }

        ], function (err) {

            if (err) {
                return callback(err);
            }

            callback();
        })
    };

    this.buySmashes = function (data, callback) {
        var uid = data.uid;
        var sid = data.smash_id;
        var achievement = CONSTANTS.ACHIEVEMENTS.SMASH_UNLOCK.NAME;
        var setId;
        var price;
        var err;
        var setSize = CONSTANTS.SMASHES_PER_SET;
        var gid;

        setId = (sid % setSize) ? 1 + (sid / setSize) | 0 : (sid / setSize) | 0;
        price = setId * CONSTANTS.SMASH_DEFAULT_PRICE;

        if (typeof callback !== 'function') {
            err = new Error(typeof callback + ' is not a function');
            throw err;
        }

        async.series([

            function (cb) {

                if (data.currency === CONSTANTS.CURRENCY_TYPE.SOFT) {

                    PostGre.knex(TABLES.GAME_PROFILE)
                        .select('stars_number', 'id')
                        .where('uuid', uid)
                        .then(function (result) {
                            gid = result[0].id;

                            err = new Error(RESPONSES.NOT_ENOUGH_STARS);
                            err.status = 400;

                            (result[0].stars_number - price) < 0 ? cb(err) : cb();
                        })
                        .catch(function (err) {
                            cb(err);
                        })
                } else {
                    cb();
                }
            },

            function (cb) {
                PostGre.knex
                    .raw('SELECT add_smashes(?, ?);', /*\'{' + sid + '}\'*/
                    [uid, sid]
                    )
                    .then(function () {
                       cb();
                    })
                    .catch(cb)
            },

            function (cb) {
                self.achievementsTrigger({
                    uuid: uid,
                    name: achievement,
                    set: setId,
                    item: sid

                }, cb)
            },

            function (cb) {

                if (data.currency === CONSTANTS.CURRENCY_TYPE.SOFT) {

                    PostGre.knex
                        .raw(
                        'UPDATE :game_profile: SET  stars_number = stars_number - :price ' +
                        'WHERE id = gid RETURNING stars_number, points_number',
                        {
                            game_profile: TABLES.GAME_PROFILE,
                            price: price,
                            gid: gid
                        }
                        )
                        .then(function (profile) {
                            cb(null, profile.rows[0])
                        })
                        .catch(function (err) {
                            cb(err)
                        })

                } else {

                    PostGre.knex
                        .raw(
                        'SELECT stars_number, points_number FROM :game_profile: WHERE id = :gid',
                        {
                            game_profile: TABLES.GAME_PROFILE,
                            gid: gid
                        }
                    )
                        .then(function (profile) {
                            cb(null, profile.rows[0]);
                        })
                        .catch(function (err) {
                            cb(err);
                        })
                }
            }

        ], function (err, result) {

            if (err) {
                return callback(err);
            }
            PostGre.knex
                .raw('SELECT calc_game_rate(?);',
                [uid]
                )
                .then(function () {
                    callback(null, result[result.length - 1]);
                })
                .catch(callback)

        })

    };

    this.addFlips = function (options, callback) {
        var uid = options.uid;
        var quantity = options.quantity;
        var actionType = options.actionType;
        var err;

        if (typeof callback !== 'function') {
            err = new Error(typeof callback + ' is not a function');
            throw err;
        }

        PostGre.knex
            .raw('SELECT add_flips(?, ?, ?);',
            [uid, quantity, actionType]
            )
            .then(function () {
                callback()
            })
            .catch(function (err) {
                callback(err)
            })
    };

    this.achievementsTrigger = function (options, callback) {
        options.set = options.set || 1;
        options.item = options.item || 1;

        PostGre.knex
            .raw('SELECT achievement(?, ?, ?, ?);',
            [options.uuid, options.name, options.set, options.item]
            )
            .then(function () {
                callback();
            })
            .catch(function (err) {
                callback(err);
            })
    };
};

module.exports = GameProfile;

