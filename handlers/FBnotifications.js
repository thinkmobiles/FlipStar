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

FBnotif = function (app) {
    var PostGre = app.get('PostGre');

    var fbHelper = new FBnotifHelper(PostGre);

    this.requestFBNotification = function (req, res, next) {
        var fuid = req.params.id;

        PostGre.knex
            .raw(
                'UPDATE ' + TABLES.FB_NOTIFICATIONS + ' SET unresponsive_notification = 0, is_newbie = false ' +
                'WHERE facebook_id = \'' + fuid + '\''
            )
            .exec(function (err) {
                if (err) {
                    return next(err)
                }
                res.status(200).send('Some content will be here')
            })
    };

    this.getbygroup = function (req, res, next) {

        var queue = app.get('eventQueue');

        fbHelper.getUsersGroup(function (err, dispatchList) {
            if (err) {
                return next(err)
            }

            queue.sendMessage('fbPush', {msg: dispatchList}, function(err){
                if (err){
                    return next(err);
                }

                res.status(200).send('SEND');
            });
        })




    };
};

module.exports = FBnotif;

