var MODELS = require('../constants/models');

var Models = function (PostGre) {
    "use strict";
    var _ = require('underscore');

    var Model = PostGre.Model.extend({
        hasTimestamps: true,
        getName: function () {
            return this.tableName.replace(/s$/, '')
        }
    });

    this[MODELS.USERS_PROFILE] = require('./userProfile')(PostGre, Model);
};
module.exports = Models;
