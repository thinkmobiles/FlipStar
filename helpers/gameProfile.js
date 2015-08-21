var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
var async = require('async');
var _ = require('lodash');
var Session = require('../handlers/sessions');
var Users;

GameProfile = function (PostGre) {
    var GameProfileModel = PostGre.Models[MODELS.GAME_PROFILE];

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

    this.getProfileById = function (uid, callback) {

        PostGre.knex(TABLES.USERS_PROFILE)
            .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
            .leftJoin(TABLES.USERS_SMASHES, TABLES.GAME_PROFILE + '.id', TABLES.USERS_SMASHES + '.game_profile_id')
            .leftJoin(TABLES.USERS_BOOSTERS, TABLES.GAME_PROFILE + '.id', TABLES.USERS_BOOSTERS + '.game_profile_id')
            .where(TABLES.GAME_PROFILE + '.id', uid)
            .select('stars_number', 'points_number', 'flips_number', 'booster_id', 'flips_left', 'is_active', TABLES.USERS_BOOSTERS + '.quantity')
            .exec(callback)
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
            })
            .exec(callback)
    };

    this.openSmashes = function (profile, smashes, callback) {
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
                        'SELECT s.id, sum(set*100) as price FROM ' + TABLES.SMASHES + ' s ' +
                        'WHERE id in ' + queryStr + ' AND id NOT IN (select s.id from smashes s ' +
                        'LEFT JOIN ' + TABLES.USERS_SMASHES + ' us on s.id = us.smash_id ' +
                        'WHERE game_profile_id = ' + profile.id + ')' +
                        'GROUP BY s.id'
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
                        isOpen: true,
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
                return callback(err)
            }
            callback()
        })
    };

    this.calculatePoints = function (uid, callback) {
        PostGre.knex
            .raw(
                'UPDATE ' + TABLES.GAME_PROFILE + ' ' +
                'SET points_number = (select sum(quantity)*sum(distinct set) + min(stars_number) AS points_number FROM ' + TABLES.GAME_PROFILE + ' gp ' +
                    'LEFT JOIN ' + TABLES.USERS_SMASHES + ' us ON us.game_profile_id = gp.id ' +
                    'LEFT JOIN ' + TABLES.SMASHES + ' s on us.smash_id = s.id ' +
                    'WHERE gp.id = ' + uid + ') ' +
                'WHERE id = ' + uid
            )
            .exec(callback)
    };

};

module.exports = GameProfile;

