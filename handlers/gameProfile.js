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

    this.getProfileById = function (req, res, next) {
        var uid = req.params.id;

        PostGre.knex(TABLES.USERS_PROFILE)
            .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
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

    this.syncOfflineGame = function (req, res, next) {
        var optins = req.body;
        var uid = req. session.uId;

        PostGre.knex(TABLES.GAME_PROFILE)
            .where('id', uid)
            .then()
    };
};

module.exports = GameProfile;

