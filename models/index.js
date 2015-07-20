var MODELS = require('../constants/models');

var Models = function (PostGre) {
    "use strict";
    var _ = require('underscore');

    var Model = PostGre.Model.extend({
        hasTimestamps: true
    });

    this[MODELS.USERS_PROFILE] = require('./userProfile')(PostGre, Model);
    this[MODELS.DEVICE] = require('./device')(PostGre, Model);
    this[MODELS.GAME_PROFILE] = require('./gameProfile')(PostGre, Model);
};
module.exports = Models;
