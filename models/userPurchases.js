/**
 * Created by migal on 28.08.15.
 */

var TABLES = require('../constants/tables');

module.exports = function(PostGre, ParentModel){
    return ParentModel.extend({
        tableName: TABLES.USERS_PURCHASES
    });
};