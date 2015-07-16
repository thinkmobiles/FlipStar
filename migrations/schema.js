module.exports = function (knex, Promise) {
    /*var TABLES = require('../constants/tables');*/
    /*var CONSTANTS = require('../constants/constants');*/
    var when = require('when');
    /*var crypto = require('crypto');*/
    var async = require('../node_modules/async');

    function create() {
        async.parallel([
            function (cb) {
                createTable('Users', function (row) {
                    row.increments('id').primary();
                    row.string('name');
                }, cb)
            },

            function (cb) {
                createTable( 'Devices', function (row) {
                    row.increments('id').primary();
                    row.integer('userId').unsigned().inTable('Users').references('id').onDelete('SET NULL')
                }, cb)
            }

        ], function(errors) {
            if (errors) {
                console.log('===============================');
                console.log(errors);
                console.log('===============================');
            } else {
                console.log('Tables Created!');
            }
        });
    }

    function createTable(tableName, crateFieldsFunc, callback) {
        knex.schema.hasTable(tableName).then(function (exists) {
            if (!exists) {
                 knex.schema.createTable(tableName, crateFieldsFunc)
                    .exec(callback);
            } else {
                callback()
            }
        });
    }


    function drop() {
        return when.all([
            knex.schema.dropTableIfExists('Users'),
            knex.schema.dropTableIfExists('Devices')
        ]);
    }

    return {
        create: create,
        drop: drop
    }
};