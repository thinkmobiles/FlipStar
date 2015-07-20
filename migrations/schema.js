module.exports = function (knex) {
    var TABLES = require('../constants/tables');
    var when = require('when');
    var async = require('../node_modules/async');

    function create() {
        async.series([

            function (cb) {
                createTable(TABLES.COUNTRIES, function (row) {
                    row.increments('id').primary();
                    row.string('iso_code').notNullable();
                    row.string('name').notNullable();

                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            },

            function (cb) {
                createTable(TABLES.LANGUAGE, function (row) {
                    row.increments('id').primary();
                    row.string('iso_code').notNullable();
                    row.string('name').notNullable();

                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            },

            function (cb) {
                createTable(TABLES.USERS_PROFILE, function (row) {
                    row.increments('id').primary();
                    row.string('facebook_id').unique();
                    row.string('first_name', 50);
                    row.string('last_name', 50);
                    row.integer('country_id').references('id').inTable(TABLES.COUNTRIES).onDelete('SET NULL').onUpdate('CASCADE');
                    row.integer('language_id').references('id').inTable(TABLES.LANGUAGE).onDelete('SET NULL').onUpdate('CASCADE');
                    row.integer('gender');
                    row.timestamp('birthday');
                    row.string('age_range');
                    row.string('email');
                    row.string('timezone');
                    row.string('phone_number');

                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            },

            function (cb) {
                createTable(TABLES.DEVICE, function (row) {
                    row.increments('id').primary();
                    row.integer('user_id').references('id').inTable(TABLES.USERS_PROFILE).onDelete('SET NULL').onUpdate('CASCADE');
                    row.string('device_id');
                    row.integer('device_type');
                    row.string('device_timezone');
                    row.string('push_token').unique();
                    row.string('push_operator');
                    row.string('content_version');
                    row.string('screen_width');
                    row.string('screen_height');
                    row.string('device_model');
                    row.string('device_manufacturer');
                    row.string('device_firmware');

                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            },

            function (cb) {
                createTable(TABLES.GAME_PROFILE, function (row) {
                    row.increments('id').primary();
                    row.integer('user_id').references('id').inTable(TABLES.USERS_PROFILE).onDelete('SET NULL').onUpdate('CASCADE');
                    row.integer('device_id').references('id').inTable(TABLES.DEVICE).onDelete('SET NULL').onUpdate('CASCADE');
                    row.string('app_platform');
                    row.timestamp('registration_date');
                    row.string('registration_week');
                    row.integer('sessions_number').defaultTo(0);
                    row.string('session_max_length');
                    row.integer('stars_number').defaultTo(0);
                    row.integer('points_number').defaultTo(0);
                    row.integer('pogs_number').defaultTo(0);
                    row.integer('flips_number').defaultTo(0);
                    row.string('app_flyer_source');
                    row.string('app_flyer_media');
                    row.string('app_flyer_campaign');
                    row.string('utm_source');
                    row.string('install_country');
                    row.string('last_login_country');
                    row.integer('real_spent');
                    row.integer('soft_currency_spent');
                    row.integer('flips_spent');
                    row.integer('fb_friends_number');
                    row.integer('shares');
                    row.integer('tools_used');
                    row.timestamp('last_seen_date');
                    row.timestamp('last_purchase_date');
                    row.timestamp('first_purchase_date');
                    row.integer('offers_seen');
                    row.integer('offers_bought');
                    row.integer('promo_seen');


                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            },

            function (cb) {
                createTable(TABLES.FRIENDS, function (row) {
                    row.increments('id').primary();
                    row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('SET NULL').onUpdate('CASCADE');
                    row.integer('friend_game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('SET NULL').onUpdate('CASCADE');

                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            },

            function (cb) {
                createTable(TABLES.SMASHES, function (row) {
                    row.increments('id').primary();
                    row.string('name', 50).notNullable();
                    row.integer('set').notNullable();

                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            },

            function (cb) {
                createTable(TABLES.USERS_SMASHES, function (row) {
                    row.increments('id').primary();
                    row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('SET NULL').onUpdate('CASCADE');
                    row.integer('smash_id').references('id').inTable(TABLES.SMASHES).onDelete('SET NULL').onUpdate('CASCADE');
                    row.integer('quantity').notNullable();

                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            },

            function (cb) {
                createTable(TABLES.ACHIEVEMENTS, function (row) {
                    row.increments('id').primary();
                    row.integer('name').notNullable();
                    row.integer('prize').notNullable();

                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            },

            function (cb) {
                createTable(TABLES.USERS_ACHIEVEMENTS, function (row) {
                    row.increments('id').primary();
                    row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('SET NULL').onUpdate('CASCADE');
                    row.integer('achievements_id').references('id').inTable(TABLES.ACHIEVEMENTS).onDelete('SET NULL').onUpdate('CASCADE');

                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            },

            function (cb) {
                createTable(TABLES.KIOSK, function (row) {
                    row.increments('id').primary();
                    row.integer('type').notNullable();
                    row.string('name').notNullable();
                    row.integer('store').notNullable();
                    row.string('store_item_id').notNullable();

                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            },

            function (cb) {
                createTable(TABLES.USERS_PURCHASES, function (row) {
                    row.increments('id').primary();
                    row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('SET NULL').onUpdate('CASCADE');
                    row.integer('purchase_id').notNullable();
                    row.integer('recipe_id').notNullable();

                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            },

            function (cb) {
                createTable(TABLES.NOTIFICATIONS_QUEUE, function (row) {
                    row.increments('id').primary();
                    row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('SET NULL').onUpdate('CASCADE');
                    row.integer('type').notNullable();
                    row.integer('priority').notNullable();

                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            },

            function (cb) {
                createTable(TABLES.NOTIFICATIONS_HISTORY, function (row) {
                    row.increments('id').primary();
                    row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('SET NULL').onUpdate('CASCADE');
                    row.integer('type').notNullable();
                    row.integer('priority').notNullable();
                    row.timestamp('delivery_date');

                    row.timestamp('updated_at', true);
                    row.timestamp('created_at', true);
                }, cb)
            }

        ], function(errors) {
            if (errors) {
                console.log('===============================');
                console.log(errors);
                console.log('===============================');
            } else {
                console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
                console.log('Tables Created!');
                console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');

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

    function dropTable(tableName, callback) {
        knex.schema
            .dropTableIfExists(tableName)
            .exec(callback)
    }


    /*function drop() {
        return when.all([
            knex.schema.dropTableIfExists(TABLES.USERS_SMASHES),
            knex.schema.dropTableIfExists(TABLES.SMASHES),
            knex.schema.dropTableIfExists(TABLES.USERS_ACHIEVEMENTS),
            knex.schema.dropTableIfExists(TABLES.ACHIEVEMENTS),
            knex.schema.dropTableIfExists(TABLES.USERS_PURCHASES),
            knex.schema.dropTableIfExists(TABLES.KIOSK),
            knex.schema.dropTableIfExists(TABLES.NOTIFICATIONS_QUEUE),
            knex.schema.dropTableIfExists(TABLES.NOTIFICATIONS_HISTORY),
            knex.schema.dropTableIfExists(TABLES.GAME_PROFILE),
            knex.schema.dropTableIfExists(TABLES.DEVICE),
            knex.schema.dropTableIfExists(TABLES.USERS_PROFILE),
            knex.schema.dropTableIfExists(TABLES.LANGUAGE),
            knex.schema.dropTableIfExists(TABLES.COUNTRIES)
        ]);
    }*/

    function drop() {
        async.series([
            function (cb) {
                dropTable(TABLES.USERS_SMASHES, cb)
            },

            function (cb) {
                dropTable(TABLES.SMASHES, cb)
            },

            function (cb) {
                dropTable(TABLES.USERS_ACHIEVEMENTS, cb)
            },

            function (cb) {
                dropTable(TABLES.ACHIEVEMENTS, cb)
            },

            function (cb) {
                dropTable(TABLES.USERS_PURCHASES, cb)
            },

            function (cb) {
                dropTable(TABLES.KIOSK, cb)
            },

            function (cb) {
                dropTable(TABLES.NOTIFICATIONS_QUEUE, cb)
            },

            function (cb) {
                dropTable(TABLES.NOTIFICATIONS_HISTORY, cb)
            },

            function (cb) {
                dropTable(TABLES.FRIENDS, cb)
            },

            function (cb) {
                dropTable(TABLES.GAME_PROFILE, cb)
            },

            function (cb) {
                dropTable(TABLES.DEVICE, cb)
            },

            function (cb) {
                dropTable(TABLES.USERS_PROFILE, cb)
            },

            function (cb) {
                dropTable(TABLES.LANGUAGE, cb)
            },

            function (cb) {
                dropTable(TABLES.COUNTRIES, cb)
            }
        ], function (err) {
            if (err) {
                console.log('===============================');
                console.log(err);
                console.log('===============================');
            } else {
                console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
                console.log('Tables Destroyed!');
                console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');

            }
        })
    }

    return {
        create: create,
        drop: drop
    }
};