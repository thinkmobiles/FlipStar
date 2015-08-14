var RESPONSES = require('../constants/responseMessages');
var TABLES = require('../constants/tables');
var GROUPS = require('../constants/FbNotificationGroup');
var async = require('async');
var _ = require('underscore');
var graph = require('fbgraph');
var Session = require('./sessions');
var GameProfHelper = require('../helpers/gameProfile');
var FBnotifHelper = require('../helpers/FBnotifications');
var Users;

FBnotif = function (PostGre) {
    var fbHelper = new FBnotifHelper(PostGre);

    this.requestFBNotification = function (req, res, next) {
        var fuid = req.params.id;

        PostGre.knex
            .raw(
                'UPDATE  fb_notifications f SET unresponsive_notification = 0, ' +
                ' is_newbie = false, updated_at = current_timestamp ' +
                'where facebook_id = \'' + fuid + '\''
            )
            .exec(function (err) {
                if (err) {
                    return next(err)
                }
                res.status(200).send('Some content will be here')
            })
    };

    this.sendNotification = function (req, res, next) {
        graph.setAccessToken(process.env.ACCESS_TOKEN);

        var data = {
            href: 'user/fb/' + fuid,
            template: 'Hello world'
        };

        graph.post('/' + fuid + '/notifications', data, function(err, response) {
            console.log(response);
            PostGre.knex
                .raw(
                    'UPDATE  fb_notifications f SET unresponsive_notification = unresponsive_notification + 1, ' +
                    'is_newbie = false, notification_date = current_timestamp, updated_at = current_timestamp ' +
                    'where facebook_id = \'' + fuid + '\''
                )
                .exec(function (err) {
                    if (err) {
                        return next(err)
                    }
                    res.status(200).send('SEND')
                })
        });
    };

    this.getbygroup = function (req, res, next) {
        fbHelper.getUsersGroup(function (err, dispatchList) {
            if (err) {
                return next(err)
            }
            fbHelper.sendNotification(dispatchList, function (err) {
                if (err) {
                    return next(err)
                }
                res.status(200).send('SEND')
            })
        })
    };
};

module.exports = FBnotif;

