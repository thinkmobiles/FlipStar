var MODELS = require('../constants/models');

var Models = function (PostGre) {
    "use strict";
    //var _ = require('underscore');

    var Model = PostGre.Model.extend({
        hasTimestamps: true
    });

    this[MODELS.USERS_PROFILE] = require('./userProfile')(PostGre, Model);
    this[MODELS.DEVICE] = require('./device')(PostGre, Model);
    this[MODELS.GAME_PROFILE] = require('./gameProfile')(PostGre, Model);
    this[MODELS.USERS_PURCHASES] = require('./userPurchases')(PostGre, Model);
    this[MODELS.KIOSK] = require('./purchase')(PostGre, Model);
    this[MODELS.BOOSTERS] = require('./boosters')(PostGre, Model);
    this[MODELS.USERS_BOOSTERS] = require('./userBoosters')(PostGre, Model);
    this[MODELS.USERS_SMASHES] = require('./userSmashes')(PostGre, Model);
    this[MODELS.NOTIFICATIONS_HISTORY] = require('./notificationsHistory')(PostGre, Model);
};
module.exports = Models;
