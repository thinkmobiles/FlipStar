module.exports = function (knex) {
    var TABLES = require('../constants/tables');
    var when = require('when');
    var async = require('../node_modules/async');
    var _ = require('lodash');

    function create() {
        async.series([

            function (cb) {
                knex.raw(
                    'CREATE OR REPLACE FUNCTION update_updated_at_column() ' +
                    'RETURNS TRIGGER AS $$ ' +
                        'BEGIN ' +
                            'NEW.updated_at = now(); ' +
                            'RETURN NEW; ' +
                        'END; ' +
                    '$$ language plpgsql;'
                    )
                    .exec(function (err) {
                        if (err) {
                            console.log('!!!!!!!!!');
                            console.log(err);
                            console.log('!!!!!!!!!');
                        } else {
                            console.log('##########');
                            console.log('Create function');
                            console.log('###########');
                        }
                        cb()
                    })
            },

            function (cb) {
                knex.raw(
                    'CREATE OR REPLACE FUNCTION del_expire_booster() ' +
                    'RETURNS TRIGGER AS $$ ' +
                        'BEGIN ' +
                            'DELETE FROM ' + TABLES.USERS_BOOSTERS + ' WHERE flips_left = 0 AND quantity = 0; ' +
                            'RETURN NULL; ' +
                        'END; ' +
                    '$$ language plpgsql;'
                )
                .exec(function (err) {
                    if (err) {
                        console.log('!!!!!!!!!');
                        console.log(err);
                        console.log('!!!!!!!!!');
                    } else {
                        console.log('##########');
                        console.log('Create function');
                        console.log('###########');
                    }
                    cb()
                })
            },

            function (cb) {
                knex.raw(
                    'CREATE OR REPLACE FUNCTION desactivate_booster() ' +
                    'RETURNS TRIGGER AS $$ ' +
                        'BEGIN ' +
                            'UPDATE ' + TABLES.USERS_BOOSTERS + ' SET is_active = false, quantity = quantity -1, flips_left = 100  WHERE flips_left = 0; ' +
                            'RETURN NULL; ' +
                        'END; ' +
                    '$$ language plpgsql;'
                    )
                    .exec(function (err) {
                        if (err) {
                            console.log('!!!!!!!!!');
                            console.log(err);
                            console.log('!!!!!!!!!');
                        } else {
                            console.log('##########');
                            console.log('Create function');
                            console.log('###########');
                        }
                        cb()
                    })
            },

            function (cb) {
                knex.raw(
                        'CREATE OR REPLACE FUNCTION game(guid INT, stars INT) RETURNS TABLE (id int, stars_quantity int,flips int, point int, boosters int, left_flips int) AS ' +
                        '$$ ' +
                            'BEGIN ' +
                                'UPDATE ' + TABLES.GAME_PROFILE + ' gp SET stars_number = stars_number + stars, points_number = points_number + stars, flips_number = flips_number - 1, flips_spent = flips_spent + 1   WHERE gp.id = guid; ' +
                                'IF found THEN ' +
                                    'UPDATE ' + TABLES.USERS_BOOSTERS + '  SET flips_left = flips_left - 1   WHERE game_profile_id = guid AND is_active = true; ' +
                                    'RETURN QUERY ' +
                                        'SELECT gp.id, gp.stars_number, gp.flips_number, gp.points_number, ub.booster_id, ub.flips_left FROM ' + TABLES.GAME_PROFILE + ' gp ' +
                                        'LEFT JOIN ' + TABLES.USERS_BOOSTERS + ' ub ON gp.id = ub.game_profile_id AND ub.is_active = true ' +
                                        'WHERE gp.id = guid; ' +
                                'END IF; ' +
                                    'IF (SELECT flips_number FROM ' + TABLES.GAME_PROFILE + ' gp WHERE gp.id = guid) < 0 THEN ' +
                                    'RAISE EXCEPTION \'FLIPS ENDED\'; ' +
                                'END IF; ' +
                            'END; ' +
                        '$$ ' +
                        'LANGUAGE plpgsql;'
                     )
                    .exec(function (err) {
                        if (err) {
                            console.log('!!!!!!!!!');
                            console.log(err);
                            console.log('!!!!!!!!!');
                        } else {
                            console.log('##########');
                            console.log('Create function');
                            console.log('###########');
                        }
                        cb()
                    })
            },

            function (cb) {
                knex.raw(
                    'CREATE OR REPLACE FUNCTION activate_booster(guid INT, booster INT) RETURNS TABLE (id int, left_flips int) AS ' +
                    '$$ ' +
                        'BEGIN ' +
                            'UPDATE ' + TABLES.USERS_BOOSTERS + '  SET flips_left = flips_left + 100, is_active = true, quantity = quantity - 1 ' +
                            'WHERE game_profile_id = guid AND booster_id = booster; ' +
                            'RETURN QUERY SELECT booster_id, flips_left FROM ' + TABLES.USERS_BOOSTERS + ' WHERE game_profile_id = guid AND booster_id = booster;' +
                                'IF (SELECT quantity FROM ' + TABLES.USERS_BOOSTERS + ' WHERE game_profile_id = guid AND booster_id = booster) < 0 THEN ' +
                                    'RAISE EXCEPTION \'YOU CAN NOT ACTIVATE THIS BOOSTER\'; ' +
                                'END IF; ' +
                        'END; ' +
                    '$$ ' +
                    'LANGUAGE plpgsql;'
                    )
                    .exec(function (err) {
                        if (err) {
                            console.log('!!!!!!!!!');
                            console.log(err);
                            console.log('!!!!!!!!!');
                        } else {
                            console.log('##########');
                            console.log('Create function');
                            console.log('###########');
                        }
                        cb()
                    })
            },

            function (cb) {
                knex.raw(
                        'CREATE OR REPLACE FUNCTION open_smash(guid INT, sid INT) RETURNS VOID AS ' +
                            '$$ ' +
                                'BEGIN' +
                                    'LOOP ' +
                                        'UPDATE  ' + TABLES.USERS_SMASHES + ' SET is_open = true   WHERE game_profile_id = guid  AND smash_id = sid ; ' +
                                        'IF found THEN ' +
                                            'RETURN; ' +
                                        'END IF; ' +
                                        'BEGIN ' +
                                            'INSERT INTO  ' + TABLES.USERS_SMASHES + ' (game_profile_id, smash_id, is_open, quantity) VALUES (guid, sid, true, 0); ' +
                                            'RETURN; ' +
                                            'EXCEPTION WHEN unique_violation THEN ' +
                                        'END; ' +
                                    'END LOOP; ' +
                                'END; ' +
                            '$$ ' +
                        'LANGUAGE plpgsql;'
                    )
                    .exec(function (err) {
                        if (err) {
                            console.log('!!!!!!!!!');
                            console.log(err);
                            console.log('!!!!!!!!!');
                        } else {
                            console.log('##########');
                            console.log('Create function');
                            console.log('###########');
                        }
                        cb()
                    })
            },

            function (cb) {
                knex.raw(
                        'CREATE OR REPLACE FUNCTION buy_booster(guid INT, bid INT) RETURNS VOID AS ' +
                            '$$ ' +
                                'BEGIN ' +
                                    'LOOP ' +
                                        'UPDATE  ' + TABLES.USERS_BOOSTERS + ' SET quantity = quantity + 1   WHERE game_profile_id = guid  AND booster_id = bid ; ' +
                                        'IF found THEN ' +
                                            'RETURN; ' +
                                        'END IF; ' +
                                        'BEGIN ' +
                                            'INSERT INTO  ' + TABLES.USERS_BOOSTERS + ' (game_profile_id, booster_id, is_active, flips_left, quantity) VALUES (guid, bid, false, 100, 0); ' +
                                            'RETURN; ' +
                                            'EXCEPTION WHEN unique_violation THEN ' +
                                        'END; ' +
                                    'END LOOP; ' +
                                'END; ' +
                            '$$ ' +
                        'LANGUAGE plpgsql;'
                    )
                    .exec(function (err) {
                        if (err) {
                            console.log('!!!!!!!!!');
                            console.log(err);
                            console.log('!!!!!!!!!');
                        } else {
                            console.log('##########');
                            console.log('Create function');
                            console.log('###########');
                        }
                        cb()
                    })
            },

            function (cb) {
                createTable(TABLES.COUNTRIES, function (row) {
                    row.increments('id').primary();
                    row.string('iso_code').notNullable();
                    row.string('name').notNullable();

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, cb)
            },

            function (cb) {
                createTable(TABLES.LANGUAGE, function (row) {
                    row.increments('id').primary();
                    row.string('iso_code').notNullable();
                    row.string('name').notNullable();

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, cb)
            },

            function (cb) {
                createTable(TABLES.USERS_PROFILE, function (row) {
                    row.increments('id').primary();
                    row.string('facebook_id').unique();
                    row.string('first_name', 50);
                    row.string('last_name', 50);
                    row.string('country_id');//.references('id').inTable(TABLES.COUNTRIES).onDelete('SET NULL').onUpdate('CASCADE');
                    row.string('language_id');//.references('id').inTable(TABLES.LANGUAGE).onDelete('SET NULL').onUpdate('CASCADE');
                    row.string('gender');
                    row.date('birthday');
                    row.string('age_range');
                    row.string('email');
                    row.string('timezone');
                    row.string('phone_number');


                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, function () {
                    knex.raw(
                        'CREATE TRIGGER update_user_profile_updtime BEFORE UPDATE ON ' + TABLES.USERS_PROFILE + ' FOR EACH ROW EXECUTE PROCEDURE  update_updated_at_column();'
                        )
                        .exec(function (err) {
                            if (err) {
                                console.log('!!!!!!!!!');
                                console.log(err);
                                console.log('!!!!!!!!!');
                            } else {
                                console.log('##########');
                                console.log('Create TRIGGER USERS');
                                console.log('###########');
                            }
                            cb()
                        })
                })
            },

            function (cb) {
                createTable(TABLES.FB_NOTIFICATIONS, function (row) {
                    row.increments('id').primary();
                    row.string('facebook_id').unique().references('facebook_id').inTable(TABLES.USERS_PROFILE).onDelete('CASCADE').onUpdate('CASCADE');
                    row.integer('unresponsive_notification').defaultTo(0);
                    row.boolean('is_newbie').defaultTo(true);
                    row.timestamp('notification_date');

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, function () {
                    knex.raw(
                        'CREATE TRIGGER update_fb_notif_updtime BEFORE UPDATE ON ' + TABLES.FB_NOTIFICATIONS + ' FOR EACH ROW EXECUTE PROCEDURE  update_updated_at_column();'
                    )
                        .exec(function (err) {
                            if (err) {
                                console.log('!!!!!!!!!');
                                console.log(err);
                                console.log('!!!!!!!!!');
                            } else {
                                console.log('##########');
                                console.log('Create TRIGGER FB');
                                console.log('###########');
                            }
                            cb()
                        })
                })

            },

            function (cb) {
                createTable(TABLES.DEVICE, function (row) {
                    row.increments('id').primary();
                    row.integer('user_id').references('id').inTable(TABLES.USERS_PROFILE).onDelete('SET NULL').onUpdate('CASCADE');
                    row.string('device_id');
                    row.string('device_type');
                    row.string('device_timezone');
                    row.string('push_token').unique();
                    row.string('push_operator');
                    row.string('content_version');
                    row.string('screen_width');
                    row.string('screen_height');
                    row.string('device_model');
                    row.string('device_manufacturer');
                    row.string('device_firmware');

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, function () {
                    knex.raw(
                        'CREATE TRIGGER update_device_updtime BEFORE UPDATE ON ' + TABLES.DEVICE + ' FOR EACH ROW EXECUTE PROCEDURE  update_updated_at_column();'
                    )
                        .exec(function (err) {
                            if (err) {
                                console.log('!!!!!!!!!');
                                console.log(err);
                                console.log('!!!!!!!!!');
                            } else {
                                console.log('##########');
                                console.log('Create TRIGGER DEVICE');
                                console.log('###########');
                            }
                            cb()
                        })
                })
            },

            function (cb) {
                createTable(TABLES.GAME_PROFILE, function (row) {
                    row.increments('id').primary();
                    row.integer('user_id').references('id').inTable(TABLES.USERS_PROFILE).onDelete('CASCADE').onUpdate('CASCADE');
                    row.integer('device_id').references('id').inTable(TABLES.DEVICE).onDelete('SET NULL').onUpdate('CASCADE');
                    row.string('app_platform');
                    row.timestamp('registration_date');
                    row.string('registration_week');
                    row.integer('sessions_number').defaultTo(1);
                    row.string('session_max_length');
                    row.integer('stars_number').defaultTo(0);
                    row.integer('points_number').defaultTo(0);
                    row.integer('pogs_number').defaultTo(0);
                    row.integer('coins_number').defaultTo(0);
                    row.integer('flips_number').defaultTo(0);
                    row.string('app_flyer_source');
                    row.string('app_flyer_media');
                    row.string('app_flyer_campaign');
                    row.string('utm_source');
                    row.string('install_country');
                    row.string('last_login_country');
                    row.integer('real_spent').defaultTo(0);
                    row.integer('soft_currency_spent').defaultTo(0);
                    row.integer('flips_spent').defaultTo(0);
                    row.integer('fb_friends_number');
                    row.integer('shares');
                    row.integer('tools_used');
                    row.timestamp('last_seen_date');
                    row.timestamp('last_purchase_date');
                    row.timestamp('first_purchase_date');
                    row.integer('offers_seen');
                    row.integer('offers_bought');
                    row.integer('promo_seen');


                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, function () {
                    knex.raw(
                        'CREATE TRIGGER update_fb_game_updtime BEFORE UPDATE ON ' + TABLES.GAME_PROFILE + ' FOR EACH ROW EXECUTE PROCEDURE  update_updated_at_column();'
                    )
                        .exec(function (err) {
                            if (err) {
                                console.log('!!!!!!!!!');
                                console.log(err);
                                console.log('!!!!!!!!!');
                            } else {
                                console.log('##########');
                                console.log('Create TRIGGER GAME');
                                console.log('###########');
                            }
                            cb()
                        })
                })
            },

            function (cb) {
                createTable(TABLES.BOOSTERS, function (row) {
                    row.increments('id').primary();
                    row.string('name');
                }, cb)
            },

            function (cb) {
                createTable(TABLES.USERS_BOOSTERS, function (row) {
                    row.increments('id').primary();
                    row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('CASCADE').onUpdate('CASCADE');
                    row.integer('booster_id').references('id').inTable(TABLES.BOOSTERS).onDelete('CASCADE').onUpdate('CASCADE');
                    row.boolean('is_active').defaultTo(false);
                    row.integer('flips_left');
                    row.integer('quantity');

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, function () {
                    knex.raw(
                        'CREATE TRIGGER update_u_boosters_updtime BEFORE UPDATE ON ' + TABLES.USERS_BOOSTERS + ' FOR EACH ROW EXECUTE PROCEDURE  update_updated_at_column(); ' +
                        'CREATE TRIGGER desactivate_booster AFTER UPDATE ON ' + TABLES.USERS_BOOSTERS + ' FOR ROW EXECUTE PROCEDURE  desactivate_booster(); ' +
                        'CREATE TRIGGER del_booster AFTER UPDATE ON ' + TABLES.USERS_BOOSTERS + ' FOR ROW EXECUTE PROCEDURE  del_expire_booster(); '
                    )
                        .exec(function (err) {
                            if (err) {
                                console.log('!!!!!!!!!');
                                console.log(err);
                                console.log('!!!!!!!!!');
                            } else {
                                console.log('##########');
                                console.log('Create TRIGGER U_BOOSTERS');
                                console.log('###########');
                            }
                            cb()
                        })
                })
            },

            function (cb) {
                createTable(TABLES.FRIENDS, function (row) {
                    row.increments('id').primary();
                    row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('CASCADE').onUpdate('CASCADE');
                    row.integer('friend_game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('CASCADE').onUpdate('CASCADE');

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, function () {
                    knex.raw(
                        'CREATE TRIGGER update_fb_friends_updtime BEFORE UPDATE ON ' + TABLES.FRIENDS + ' FOR EACH ROW EXECUTE PROCEDURE  update_updated_at_column();'
                    )
                        .exec(function (err) {
                            if (err) {
                                console.log('!!!!!!!!!');
                                console.log(err);
                                console.log('!!!!!!!!!');
                            } else {
                                console.log('##########');
                                console.log('Create TRIGGER FRIENDS');
                                console.log('###########');
                            }
                            cb()
                        })
                })
            },

            function (cb) {
                createTable(TABLES.SMASHES, function (row) {
                    row.increments('id').primary();
                    row.string('name', 50).notNullable();
                    row.integer('set').notNullable();

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, cb)
            },

            function (cb) {
                createTable(TABLES.USERS_SMASHES, function (row) {
                    row.increments('id').primary();
                    row.boolean('is_open').defaultTo('false');
                    row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('CASCADE').onUpdate('CASCADE');
                    row.integer('smash_id').references('id').inTable(TABLES.SMASHES).onDelete('CASCADE').onUpdate('CASCADE');
                    row.integer('quantity').defaultTo(0);

                    row.unique(['game_profile_id', 'smash_id']);

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, function () {
                    knex.raw(
                        'CREATE TRIGGER update_u_smashes_updtime BEFORE UPDATE ON ' + TABLES.USERS_SMASHES + ' FOR EACH ROW EXECUTE PROCEDURE  update_updated_at_column();'
                    )
                        .exec(function (err) {
                            if (err) {
                                console.log('!!!!!!!!!');
                                console.log(err);
                                console.log('!!!!!!!!!');
                            } else {
                                console.log('##########');
                                console.log('Create TRIGGER U_SMASHES');
                                console.log('###########');
                            }
                            cb()
                        })
                })
            },

            function (cb) {
                createTable(TABLES.ACHIEVEMENTS, function (row) {
                    row.increments('id').primary();
                    row.integer('name').notNullable();
                    row.integer('prize').notNullable();

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, function () {
                    knex.raw(
                        'CREATE TRIGGER update_achiev_updtime BEFORE UPDATE ON ' + TABLES.ACHIEVEMENTS + ' FOR EACH ROW EXECUTE PROCEDURE  update_updated_at_column();'
                    )
                        .exec(function (err) {
                            if (err) {
                                console.log('!!!!!!!!!');
                                console.log(err);
                                console.log('!!!!!!!!!');
                            } else {
                                console.log('##########');
                                console.log('Create TRIGGER ACHIEV');
                                console.log('###########');
                            }
                            cb()
                        })
                })
            },

            function (cb) {
                createTable(TABLES.USERS_ACHIEVEMENTS, function (row) {
                    row.increments('id').primary();
                    row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('CASCADE').onUpdate('CASCADE');
                    row.integer('achievements_id').references('id').inTable(TABLES.ACHIEVEMENTS).onDelete('CASCADE').onUpdate('CASCADE');

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, function () {
                    knex.raw(
                        'CREATE TRIGGER update_u_achiev_updtime BEFORE UPDATE ON ' + TABLES.USERS_ACHIEVEMENTS + ' FOR EACH ROW EXECUTE PROCEDURE  update_updated_at_column();'
                    )
                        .exec(function (err) {
                            if (err) {
                                console.log('!!!!!!!!!');
                                console.log(err);
                                console.log('!!!!!!!!!');
                            } else {
                                console.log('##########');
                                console.log('Create TRIGGER U_ACHIEV');
                                console.log('###########');
                            }
                            cb()
                        })
                })
            },

            function (cb) {
                createTable(TABLES.KIOSK, function (row) {
                    row.increments('id').primary();
                    row.string('type').notNullable();
                    row.string('name').notNullable();
                    row.string('store').notNullable();
                    row.integer('value').notNullable();
                    row.string('store_item_id').notNullable();

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, function () {
                    knex.raw(
                        'CREATE TRIGGER update_kiosk_updtime BEFORE UPDATE ON ' + TABLES.KIOSK + ' FOR EACH ROW EXECUTE PROCEDURE  update_updated_at_column();'
                    )
                        .exec(function (err) {
                            if (err) {
                                console.log('!!!!!!!!!');
                                console.log(err);
                                console.log('!!!!!!!!!');
                            } else {
                                console.log('##########');
                                console.log('Create TRIGGER KIOSK');
                                console.log('###########');
                            }
                            cb()
                        })
                })
            },

            function (cb) {
                createTable(TABLES.USERS_PURCHASES, function (row) {
                    row.increments('id').primary();
                    row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('CASCADE').onUpdate('CASCADE');
                    row.integer('purchase_id').notNullable();
                    row.integer('recipe_id').notNullable();

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, function () {
                    knex.raw(
                        'CREATE TRIGGER update_u_purchases_updtime BEFORE UPDATE ON ' + TABLES.USERS_PURCHASES + ' FOR EACH ROW EXECUTE PROCEDURE  update_updated_at_column();'
                    )
                        .exec(function (err) {
                            if (err) {
                                console.log('!!!!!!!!!');
                                console.log(err);
                                console.log('!!!!!!!!!');
                            } else {
                                console.log('##########');
                                console.log('Create TRIGGER U_PURCHASES');
                                console.log('###########');
                            }
                            cb()
                        })
                })
            },

            function (cb) {
                createTable(TABLES.NOTIFICATIONS_QUEUE, function (row) {
                    row.increments('id').primary();
                    row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('CASCADE').onUpdate('CASCADE');
                    row.integer('type').notNullable();
                    row.integer('priority').notNullable();

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
                }, function () {
                    knex.raw(
                        'CREATE TRIGGER update_notif_queue_updtime BEFORE UPDATE ON ' + TABLES.NOTIFICATIONS_QUEUE + ' FOR EACH ROW EXECUTE PROCEDURE  update_updated_at_column();'
                    )
                        .exec(function (err) {
                            if (err) {
                                console.log('!!!!!!!!!');
                                console.log(err);
                                console.log('!!!!!!!!!');
                            } else {
                                console.log('##########');
                                console.log('Create TRIGGER N_QUEUE');
                                console.log('###########');
                            }
                            cb()
                        })
                })
            },

            function (cb) {
                createTable(TABLES.NOTIFICATIONS_HISTORY, function (row) {
                    row.increments('id').primary();
                    row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('CASCADE').onUpdate('CASCADE');
                    row.integer('type').notNullable();
                    row.integer('priority').notNullable();
                    row.timestamp('delivery_date');

                    row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
                    row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
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
                dropTable(TABLES.FB_NOTIFICATIONS, cb)
            },

            function (cb) {
                dropTable(TABLES.USERS_BOOSTERS, cb)
            },

            function (cb) {
                dropTable(TABLES.BOOSTERS, cb)
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

    function fillPurchasePack (cb){

        var sqlString = " CREATE OR REPLACE FUNCTION fillPacks(os VARCHAR) RETURNS VOID AS $$ " +
                            " BEGIN " +
                            " INSERT INTO purchases (type, name, store, value, store_item_id) VALUES " +
                                " ('packs', '1_packs', os, 1, os || '_p1'), " +
                                " ('packs', '5_packs', os, 5, os || '_p2'), " +
                                " ('packs', '12_packs', os, 12, os || '_p3'), " +
                                " ('packs', '40_packs', os, 40, os || '_p4'), " +
                                " ('packs', '60_packs', os, 60, os || '_p5'), " +
                                " ('flips', '15_flips', os, 15, os || '_f1'), " +
                                " ('flips', '40_flips', os, 40, os || '_f2'), " +
                                " ('flips', '100_flips', os, 100, os || '_f3'), " +
                                " ('flips', '350_flips', os, 350, os || '_f4'), " +
                                " ('flips', '600_flips', os, 600, os || '_f5'), " +
                                " ('stars', '200000_stars', os, 200000, os || '_s1'), " +
                                " ('stars', '1000000_stars', os, 1000000, os || '_s2'), " +
                                " ('stars', '2500000_stars', os, 2500000, os || '_s3'), " +
                                " ('stars', '10000000_stars', os, 10000000, os || '_s4'), " +
                                " ('stars', '15000000_stars', os, 15000000, os || '_s5'), " +
                                " ('boosters', 'slow_strength_bar', os, 0, os || '_b1'), " +
                                " ('boosters', 'slow_aiming_bar', os, 0, os || '_b2'), " +
                                " ('boosters', 'double_gold_rewards', os, 0, os || '_b3'); " +

                            " END; " +
                        " $$ LANGUAGE plpgsql; ";


        knex
            .raw(sqlString)
            .exec(function(err){
                if(err){
                    return cb(err);
                }

                cb(null);
            });
    }

    function fillSmashes (cb){
        var sqlString = "CREATE OR REPLACE FUNCTION fillSmashes() RETURNS VOID AS $$ " +
                            " declare counter int := 1; " +
                            " BEGIN " +
                                " WHILE (counter <= 300) LOOP " +
                                    " INSERT INTO smashes (name, set) VALUES ('AAA', (((counter - 1) / 15) | 0) + 1); " +
                                        " counter := counter + 1; " +
                                " END LOOP; " +
                            " END; " +
                        " $$ LANGUAGE plpgsql; ";

        knex
            .raw(sqlString)
            .exec(function(err){
                if(err){
                   return cb(err);
                }

                cb(null);

            })

    }

    function fillBoosters (cb) {
        var sqlString = " CREATE OR REPLACE FUNCTION fillBoosters() RETURNS VOID AS $$ " +
                            " BEGIN " +
                                " INSERT INTO boosters (name) VALUES " +
                                "('slow_strength_bar'), " +
                                " ('slow_aiming_bar'), " +
                                " ('double_gold_rewards'); " +
                            " END; " +
                        " $$ LANGUAGE plpgsql; ";

        knex
            .raw(sqlString)
            .exec(function(err){
                if (err){
                    return cb(err);
                }

                cb(null);
            })
    }

    function setDefaultOptions () {

        async.parallel([
            fillPurchasePack,
            fillSmashes,
            fillBoosters
        ],function(err){
            if (err) {
                console.log('===============================');
                console.log(err);
                console.log('===============================');
            } else {

                async.series([
                    function(cb){
                        knex
                            .raw("SELECT fillSmashes(); ")
                            .exec(cb);
                    },

                    function(cb){
                        knex
                            .raw(" SELECT fillPacks('APPLE'); ")
                            .exec(cb);
                    },

                    function(cb){
                        knex
                            .raw(" SELECT fillPacks('GOOGLE'); ")
                            .exec(cb);
                    },

                    function(cb){
                        knex
                            .raw("SELECT fillBoosters(); ")
                            .exec(cb)
                    }

                ], function(err){
                    if (err){

                        console.log('===============================');
                        console.log(err);
                        console.log('===============================');

                    } else {

                        console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
                        console.log('Default options filled successfully');
                        console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');

                    }
                })

            }
        });


    }

    return {
        create: create,
        drop: drop,
        setDefaultData: setDefaultOptions
    }
};