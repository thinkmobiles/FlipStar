var RESPONSES = require('../constants/responseMessages');
var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
var async = require('async');
var _ = require('underscore');
var Session = require('./sessions');
var GameProfHelper = require('../helpers/gameProfile');
var FBnotifHelper = require('../helpers/FBnotifications');
var Users;

FBnotif = function (PostGre) {
    var gameProfHelper = new GameProfHelper(PostGre);
    var fbNotifHelper = new FBnotifHelper(PostGre);
    var session = new Session(PostGre);



};

module.exports = FBnotif;

