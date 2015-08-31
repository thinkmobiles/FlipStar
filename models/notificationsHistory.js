/**
 * Created by migal on 03.08.15.
 */

var TABLES = require('../constants/tables');

module.exports = function(PostGre, ParentModel){
    return ParentModel.extend({
        tableName: TABLES.NOTIFICATIONS_HISTORY
    });
};