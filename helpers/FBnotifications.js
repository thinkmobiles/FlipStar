var RESPONSES = require('../constants/responseMessages');
var TABLES = require('../constants/tables');
var GROUPS = require('../constants/FbNotificationGroup');
var async = require('async');
var _ = require('underscore');
var GameProfHelper = require('../helpers/gameProfile');
var UserProfHelper = require('../helpers/userProfile');
var Users;

FBnotif = function (PostGre) {
    var gameProfHelper = new GameProfHelper(PostGre);
    var userProfHelper = new UserProfHelper(PostGre);

    this.getUsersGroup = function (groupType, callback) {
       var err;

        switch (groupType) {

            case GROUPS.GROUP_A :
                PostGre.knex
                    .raw(
                        'select fb.facebook_id from ' + TABLES.FB_NOTIFICATIONS + ' fb ' +
                        'left join ' + TABLES.USERS_PROFILE + ' u on fb.facebook_id = u.facebook_id ' +
                        'left join ' + TABLES.GAME_PROFILE + ' g on g.user_id = u.id ' +
                        'where fb.is_newbie = true and extract(days from (current_timestamp - g.last_seen_date)) <= 28'
                    )
                    .exec(function (err, users) {
                        if (err) {
                            callback(err)
                        } else {
                            callback(null, _.pluck(users.rows, 'facebook_id'))
                        }
                    });
                break;

            case GROUPS.GROUP_B :
                PostGre.knex
                    .raw(
                        'select facebook_id from ' + TABLES.FB_NOTIFICATIONS + ' ' +
                        'where unresponsive_notification is null and is_newbie = false'
                    )
                    .exec(function (err, users) {
                        if (err) {
                            callback(err)
                        } else {
                            callback(null, _.pluck(users.rows, 'facebook_id'))
                        }
                    });
                break;

            case GROUPS.GROUP_C :
                PostGre.knex
                    .raw(
                        'select facebook_id from ' + TABLES.FB_NOTIFICATIONS + ' ' +
                        'where unresponsive_notification = 1'
                    )
                    .exec(function (err, users) {
                        if (err) {
                            callback(err)
                        } else {
                            callback(null, _.pluck(users.rows, 'facebook_id'))
                        }
                    });
                break;

            case GROUPS.GROUP_D :
                PostGre.knex
                    .raw(
                        'select facebook_id from ' + TABLES.FB_NOTIFICATIONS + ' ' +
                        'where unresponsive_notification = 2'
                    )
                    .exec(function (err, users) {
                        if (err) {
                            callback(err)
                        } else {
                            callback(null, _.pluck(users.rows, 'facebook_id'))
                        }
                    });
                break;

            case GROUPS.GROUP_E :
                PostGre.knex
                    .raw(
                        'select u.facebook_id from ' + TABLES.GAME_PROFILE + ' g ' +
                        'left join ' + TABLES.USERS_PROFILE + ' u on g.user_id = u.id ' +
                        'where extract(days from (current_timestamp - g.last_seen_date)) > 28'
                    )
                    .exec(function (err, users) {
                        if (err) {
                            callback(err)
                        } else {
                            callback(null, _.pluck(users.rows, 'facebook_id'))
                        }
                    });
                break;

            default:
                err = new Error(RESPONSES.INVALID_PARAMETERS);
                err.status = 400;
                callback(err)
        }
    };

};

module.exports = FBnotif;