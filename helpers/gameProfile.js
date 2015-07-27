var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
var async = require('async');
var _ = require('lodash');
var Session = require('../handlers/sessions');
var Users;

GameProfile = function (PostGre) {
    var UserModel = PostGre.Models[MODELS.USERS_PROFILE];
    var DeviceModel = PostGre.Models[MODELS.DEVICE];
    var GameProfileModel = PostGre.Models[MODELS.GAME_PROFILE];
    var session = new Session(PostGre)

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
            .where(TABLES.GAME_PROFILE + '.id', uid)
            .select('first_name', 'last_name', 'stars_number', 'points_number', 'pogs_number', 'flips_number', 'last_seen_date')
            .limit(1)
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

    this.addSmashes = function (data, callback) {

    };

    this.calculatePoints = function (uid, callback) {
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

};

module.exports = GameProfile;

