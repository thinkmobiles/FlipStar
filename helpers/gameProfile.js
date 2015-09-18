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

    function prepareGameProfSaveInfo (options) {
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

        for (var i = value.length; i--;){

            gameProfile[value[i]] = options[value[i]] ? options[value[i]] : null;
        }

        gameProfile.last_seen_date = new Date();

        return gameProfile;
    }

    this.getProfileById = function (uid, callback) {

        PostGre.knex(TABLES.USERS_PROFILE)
            .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
            //.leftJoin(TABLES.USERS_SMASHES, TABLES.GAME_PROFILE + '.id', TABLES.USERS_SMASHES + '.game_profile_id')
            .leftJoin(TABLES.USERS_BOOSTERS, TABLES.GAME_PROFILE + '.id', TABLES.USERS_BOOSTERS + '.game_profile_id')
            .where(TABLES.GAME_PROFILE + '.id', uid)
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
                id: uid
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

    this.syncOpenSmashes = function (uid, smashes, callback) {
        var insertObj = [];
        var queryStr = '';
        var price = 0;
        var updProf = {
            last_seen_date: new Date()
        };

        for (var i = smashes.length; i--;) {
            queryStr += '\'' + smashes[i] + '\'' + ','
        }

        queryStr = queryStr.slice(0, -1);
        queryStr ='('  + queryStr + ')';

        PostGre.knex(TABLES.GAME_PROFILE)
            .where('id', uid)
            .then(function (profile) {

                async.waterfall([

                    function (cb) {
                        PostGre.knex
                            .raw(
                                'SELECT s.id, sum(set*' + CONSTANTS.SMASH_DEFAULT_PRICE + ') as price FROM ' + TABLES.SMASHES + ' s ' +
                                'WHERE id in ' + queryStr + ' AND id NOT IN (select s.id from smashes s ' +
                                'LEFT JOIN ' + TABLES.USERS_SMASHES + ' us on s.id = us.smash_id ' +
                                'WHERE game_profile_id = ' + profile[0].id + ')' +
                                'GROUP BY s.id'
                            )
                            .then(function (result) {
                                cb(null, result.rows)
                            })
                            .catch(function (err) {
                                cb(err)
                            })
                    },

                    function (data, cb) {

                        for (var i = data.length; i--;) {

                            insertObj.push({
                                game_profile_id: profile[0].id,
                                smash_id: data[i].id,
                                is_open: true
                            });

                            price += parseInt(data[i].price);
                        }

                        if (price < profile[0].stars_number) {

                            updProf.stars_number = profile[0].stars_number - price;

                            if (insertObj.length) {

                                PostGre.knex(TABLES.USERS_SMASHES)
                                    .insert(insertObj)
                                    .then(function () {
                                        cb()
                                    })
                                    .catch(function (err) {
                                        cb(err)
                                    })

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
                        .where('id', uid)
                        .update(updProf)
                        .then(function () {
                            callback()
                        })
                        .catch(function (err) {
                            callback(err)
                        })


                })
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
        var boosters = _.flatten( _.pluck(gameList, 'boosters_id'));
        var updProf = {};
        var maxFlips;
        var gamesLength;

        PostGre.knex(TABLES.GAME_PROFILE)
            .where('id', uid)
            .then(function (profile) {

                updProf.last_seen_date = curDate;
                updProf.id = profile[0].id;
                updProf.stars_number = profile[0].stars_number;

                maxFlips = parseInt((curDate - profile[0].last_seen_date)/(1000*60*60)) * CONSTANTS.FLIPS_PER_HOUR + profile[0].flips_number;
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
                            'UPDATE ' + TABLES.USERS_BOOSTERS + ' SET is_active = true, flips_left = flips_left - 1 ' +
                            'WHERE game_profile_id = ' + uid + ' AND booster_id = ' + booster
                        )
                        .then(function () {
                            cb()
                        })
                        .catch(function (err) {
                            cb(err)
                        })

                }, function (err) {

                    if (err) {
                        return callback(err)
                    }

                    PostGre.knex(TABLES.GAME_PROFILE)
                        .where('id', uid)
                        .update(updProf)
                        .then(function () {
                            callback()
                        })
                        .catch(function (err) {
                            callback(err)
                        })
                })

            })
            .catch(function (err) {
                callback(err)
            })
    };

    this.syncBoughtSmashes = function (uid, smashes, callback) {
        var setId;
        var price;
        var totalPrice = 0;
        var updProf = {
            last_seen_date: new Date()
        };


        PostGre.knex(TABLES.GAME_PROFILE)
            .where('id', uid)
            .then(function (profile) {

                for (var i = smashes.length; i--;) {
                    (smashes[i]%15) ? setId = 1 + (smashes[i]/15) | 0 : setId = (smashes[i]/15) | 0;
                    price = setId * CONSTANTS.SMASH_DEFAULT_PRICE;

                    totalPrice += price;
                }

                if (profile[0].stars_number - totalPrice < 0) {

                    callback()

                } else {

                    updProf.stars_number = profile[0].stars_number - totalPrice;

                    async.each(smashes, function (smash, cb) {

                        PostGre.knex
                            .raw(
                                'UPDATE users_smashes SET quantity = quantity + 1 ' +
                                'WHERE smash_id = ' + smash + ' AND game_profile_id = ' + uid
                            )
                            .then(function () {
                                cb()
                            })
                            .catch(function (err) {
                                cb(err)
                            })

                    }, function (err) {

                        if (err) {
                            return callback(err)
                        }

                        PostGre.knex(TABLES.GAME_PROFILE)
                            .where('id', uid)
                            .update(updProf)
                            .then(function () {
                                callback()
                            })
                            .catch(function (err) {
                                callback(err)
                            })
                    })
                }
            })
            .catch(function (err) {
                callback(err)
            })
    };

    this.addSmashes = function (options, callback) {
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
                    'UPDATE ' + TABLES.USERS_SMASHES + ' set updated_at = now(), quantity = quantity + ' + '\'' + quantities[smashesId.indexOf(smash)] + '\' '+
                    'WHERE game_profile_id = ' + uid + ' AND smash_id = ' + smash +
                    'RETURNING users_smashes.id'
                )
                .then(function (result) {

                    if (result.rows.length) {
                        cb()

                    } else {

                        PostGre.knex(TABLES.USERS_SMASHES)
                            .insert(insertObj)
                            .then(function () {
                                cb()
                            })
                            .catch(function (err) {
                                cb(err)
                            })
                    }
                })
                .catch(function (err) {
                    cb(err)
                })

        }, function (err) {

            if (err) {
                return callback(err)
            }

            callback()
        })
    };

    this.calculatePoints = function (uid, callback) {

        PostGre.knex
            .raw(
                'UPDATE ' + TABLES.GAME_PROFILE + ' ' +
                'SET points_number = (SELECT COALESCE( SUM(quantity)*SUM(distinct set) , \'0\' ) + MIN(stars_number) AS points_number FROM ' + TABLES.GAME_PROFILE + ' gp ' +
                    'LEFT JOIN ' + TABLES.USERS_SMASHES + ' us ON us.game_profile_id = gp.id ' +
                    'LEFT JOIN ' + TABLES.SMASHES + ' s on us.smash_id = s.id ' +
                    'WHERE gp.id = ' + uid + ') ' +
                'WHERE id = ' + uid
            )
            .then(function () {
                callback()
            })
            .catch(function (err) {
                callback(err)
            })
    };

    this.openSmashes = function (data, callback) {
        var err;
        var uid = data.uid;
        var sid = data.smash_id;
        var setId;
        var price;
        var setSize = CONSTANTS.SMASHES_PER_SET;

        setId = (sid%setSize) ? 1 + (sid/setSize) | 0 :  (sid/setSize) | 0;

        price = setId * CONSTANTS.SMASH_DEFAULT_PRICE;

        if (typeof callback !== 'function') {
            err = new Error(typeof callback + ' is not a function');
            throw err;
        }

        async.series([

            function (cb) {

                if (data.currency === CONSTANTS.CURRENCY_TYPE.SOFT) {

                    PostGre.knex(TABLES.GAME_PROFILE)
                        .select('stars_number')
                        .where('id', uid)
                        .then(function (result) {
                            err = new Error(RESPONSES.NOT_ENOUGH_STARS);
                            err.status = 400;

                            (result[0].stars_number - price) < 0 ? cb(err) : cb();
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                } else {
                    cb()
                }
            },

            function (cb) {
                PostGre.knex
                    .raw('SELECT open_smash(' + uid + ', ' + sid + ')')
                    .then(function () {
                        cb()
                    })
                    .catch(function (err) {
                        cb(err)
                    })
            },

            function (cb) {

                if (data.currency === CONSTANTS.CURRENCY_TYPE.SOFT) {

                    PostGre.knex
                        .raw(
                            'UPDATE ' + TABLES.GAME_PROFILE + ' ' +
                            'SET  stars_number = stars_number - ' + price + ', ' +
                                'points_number = (select sum(quantity)*sum(distinct set) + min(stars_number - ' + price + ')  AS points_number ' +
                                    'FROM ' + TABLES.GAME_PROFILE + ' gp ' +
                                    'LEFT JOIN ' + TABLES.USERS_SMASHES + ' us ON us.game_profile_id = gp.id ' +
                                    'LEFT JOIN ' + TABLES.SMASHES + ' s on us.smash_id = s.id ' +
                                    'WHERE gp.id = ' + uid + ') ' +
                            'WHERE id = ' + uid + ' ' +
                            'RETURNING stars_number, points_number'
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
                            'UPDATE ' + TABLES.GAME_PROFILE + ' ' +
                            'SET  points_number = (select sum(quantity)*sum(distinct set) + min(stars_number - ' + price + ')  AS points_number ' +
                                'FROM ' + TABLES.GAME_PROFILE + ' gp ' +
                                'LEFT JOIN ' + TABLES.USERS_SMASHES + ' us ON us.game_profile_id = gp.id ' +
                                'LEFT JOIN ' + TABLES.SMASHES + ' s on us.smash_id = s.id ' +
                                'WHERE gp.id = ' + uid + ') ' +
                            'WHERE id = ' + uid + ' ' +
                            'RETURNING stars_number, points_number'
                        )
                        .then(function (profile) {
                            cb(null, profile.rows[0])
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                }
            }

        ], function (err, result) {

            if (err) {
                return callback(err)
            }

            callback(null, result[2]);
        })


    };

    this.buySmashes = function (data, callback) {
        var uid = data.uid;
        var sid = data.smash_id;
        var setId;
        var price;
        var err;
        var setSize = CONSTANTS.SMASHES_PER_SET;

        setId = (sid%setSize) ? 1 + (sid/setSize) | 0 :  (sid/setSize) | 0;
        price = setId * CONSTANTS.SMASH_DEFAULT_PRICE;

        if (typeof callback !== 'function') {
            err = new Error(typeof callback + ' is not a function');
            throw err;
        }

        async.series([

            function (cb) {

                if (data.currency === CONSTANTS.CURRENCY_TYPE.SOFT) {

                    PostGre.knex(TABLES.GAME_PROFILE)
                        .select('stars_number')
                        .where('id', uid)
                        .then(function (result) {
                            err = new Error(RESPONSES.NOT_ENOUGH_STARS);
                            err.status = 400;

                            (result && result[0].stars_number - price) < 0 ? cb(err) : cb();
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                } else {
                    cb()
                }
            },

            function (cb) {
                PostGre.knex
                    .raw(
                        'UPDATE users_smashes ' +
                        'SET quantity = quantity + 1 ' +
                        'WHERE is_open = true AND game_profile_id =  ' + uid + ' AND smash_id =  ' + sid
                    )
                    .then(function (queryResult) {
                        err = new Error(RESPONSES.NOT_OPEN);
                        err.status = 400;

                        queryResult.rowCount ? cb() : cb(err)

                    })
                    .catch(function (err) {
                        cb(err)
                    })
            },

            function (cb) {

                if (data.currency === CONSTANTS.CURRENCY_TYPE.SOFT) {

                    PostGre.knex
                        .raw(
                            'UPDATE ' + TABLES.GAME_PROFILE + ' ' +
                            'SET  stars_number = stars_number - ' + price + ', ' +
                            'points_number = (select sum(quantity)*sum(distinct set) + min(stars_number - ' + price + ')  AS points_number ' +
                            'FROM ' + TABLES.GAME_PROFILE + ' gp ' +
                            'LEFT JOIN ' + TABLES.USERS_SMASHES + ' us ON us.game_profile_id = gp.id ' +
                            'LEFT JOIN ' + TABLES.SMASHES + ' s on us.smash_id = s.id ' +
                            'WHERE gp.id = ' + uid + ') ' +
                            'WHERE id = ' + uid + ' ' +
                            'RETURNING stars_number, points_number'
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
                            'UPDATE ' + TABLES.GAME_PROFILE + ' ' +
                            'SET  points_number = (select sum(quantity)*sum(distinct set) + min(stars_number)  AS points_number ' +
                            'FROM ' + TABLES.GAME_PROFILE + ' gp ' +
                            'LEFT JOIN ' + TABLES.USERS_SMASHES + ' us ON us.game_profile_id = gp.id ' +
                            'LEFT JOIN ' + TABLES.SMASHES + ' s on us.smash_id = s.id ' +
                            'WHERE gp.id = ' + uid + ') ' +
                            'WHERE id = ' + uid + ' ' +
                            'RETURNING stars_number, points_number'
                        )
                        .then(function (profile) {
                            cb(null, profile.rows[0])
                        })
                        .catch(function (err) {
                            cb(err)
                        })
                }
            }

        ], function (err, result) {
            if (err) {
                return callback(err)
            }

            callback(null, result[2]);
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
            .raw('SELECT add_flips(' + uid + ', ' + quantity + ', ' + actionType + ');')
            .then(function () {
                callback()
            })
            .catch(function (err) {
                callback(err)
            })
    };
};

module.exports = GameProfile;

