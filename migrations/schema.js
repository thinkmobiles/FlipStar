module.exports = function (knex) {
    var TABLES = require('../constants/tables');
    var CONSTANTS = require('../constants/constants');
    var when = require('when');
    var async = require('../node_modules/async');

    function triggerUpdateDate(cb) {
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
    }

    function triggerDeleteExpBooster(cb) {
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
    }

    function triggerDesactivateBooster(cb) {
        knex.raw(
            'CREATE OR REPLACE FUNCTION desactivate_booster() ' +
            'RETURNS TRIGGER AS $$ ' +
            'BEGIN ' +
            'UPDATE ' + TABLES.USERS_BOOSTERS + ' SET is_active = false WHERE flips_left = 0 AND is_active = true; ' +
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
    }

    function calcRate(cb) {
        knex.raw(
                'CREATE OR REPLACE FUNCTION calc_game_rate(usid uuid) ' +
                'RETURNS integer AS ' +
                '$BODY$ ' +
                'declare rate integer; ' +
                'declare game_pr integer; ' +
                'begin ' +
                'select ' +
                'coalesce( ' +
                '(max(gp.stars_number)/2) + coalesce( sum(aa.sum_) *(1+ sum(CASE WHEN aa.COUNT_=20 THEN aa.set ELSE 0 END ) ) ,0) ' +
                ',0) , gp.id into rate ,game_pr ' +
                'from ' + TABLES.GAME_PROFILE + '  gp ' +
                'left join ' +
                '(select ' +
                'us.game_profile_id, sum(coalesce(us.quantity, 0)) as sum_,count(*) as count_ , set ' +
                'from ' + TABLES.USERS_SMASHES + ' us ' +
                'left join ' + TABLES.SMASHES + ' s on s.id=us.smash_id ' +
                'where us.quantity >0 ' +
                'group by  set,us.game_profile_id ' +
                ') aa  on aa.game_profile_id=gp.id ' +
                'where gp.uuid=usid ' +
                'group by gp.id; ' +
                'update ' + TABLES.GAME_PROFILE + ' set game_rate_point=rate where id =game_pr ; ' +
                'RETURN rate; ' +
                'end ' +
                '$BODY$ ' +
                'LANGUAGE plpgsql'
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
    }

    function singleGame(cb) {
        knex.raw(
            'CREATE OR REPLACE FUNCTION game(guid uuid, stars INT) RETURNS TABLE (id int, stars_quantity int,flips int, point int, boosters int, left_flips int) AS ' +
            '$$ ' +
            'BEGIN ' +
            'UPDATE ' + TABLES.GAME_PROFILE + ' gp ' +
            'SET stars_number = stars_number + stars, game_rate_point = game_rate_point + stars/2, ' +
            'flips_number = flips_number - 1, flips_spent = flips_spent + 1   ' +
            'WHERE gp.uuid = guid; ' +
            'IF found THEN ' +
            'UPDATE ' + TABLES.USERS_BOOSTERS + '  SET flips_left = flips_left - 1   WHERE game_profile_id = ( ' +
            'SELECT g.id FROM game_profile g WHERE g.uuid = guid ) ' +
            ' AND is_active = true; ' +
            'RETURN QUERY ' +
            'SELECT gp.id, gp.stars_number, gp.flips_number, gp.points_number, ub.booster_id, ub.flips_left FROM ' + TABLES.GAME_PROFILE + ' gp ' +
            'LEFT JOIN ' + TABLES.USERS_BOOSTERS + ' ub ON gp.id = ub.game_profile_id AND ub.is_active = true ' +
            'WHERE gp.uuid = guid; ' +
            'END IF; ' +
            'IF (SELECT flips_number FROM ' + TABLES.GAME_PROFILE + ' gp WHERE gp.uuid = guid) < 0 THEN ' +
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
    }

    function achievementFunc(cb) {
        knex.raw(
            'CREATE OR REPLACE FUNCTION achievement( ' +
            'guid uuid, ' +
            'ach_name text, ' +
            'set integer, ' +
            'item integer) ' +
            'RETURNS void AS ' +
            '$$ ' +
            'DECLARE gid INT; aid INT; a_type INT; a_prize INT; ' +
            'BEGIN ' +
            'SELECT id,type,prize  INTO aid,a_type,a_prize FROM ' + TABLES.ACHIEVEMENTS + ' WHERE name = ach_name; ' +
            'SELECT id into gid FROM ' + TABLES.GAME_PROFILE + ' WHERE uuid = guid; ' +
            'IF aid IS NULL ' +
            'THEN RAISE EXCEPTION \'NO SUCH ACHIEVEMENTS\'; ' +
            'END IF; ' +
            'IF gid IS NULL ' +
            'THEN RAISE EXCEPTION \'NO SUCH USER\'; ' +
            'END IF; ' +
            'IF a_type <> 0 ' +
            'THEN ' +
            'LOOP ' +
            'UPDATE ' + TABLES.USERS_ACHIEVEMENTS + ' SET count = count + 1   WHERE game_profile_id = gid AND  achievements_id = aid ; ' +
            'IF found THEN ' +
            'UPDATE ' + TABLES.GAME_PROFILE + ' SET points_number = points_number + a_prize ' +
            'WHERE id = gid; ' +
            'RETURN; ' +
            'END IF; ' +
            'BEGIN ' +
            'INSERT INTO ' + TABLES.USERS_ACHIEVEMENTS + '(game_profile_id, achievements_id, count) VALUES (gid, aid, 1); ' +
            'UPDATE ' + TABLES.GAME_PROFILE + ' SET points_number = points_number + a_prize ' +
            'WHERE id = gid; ' +
            'RETURN; ' +
            'EXCEPTION WHEN unique_violation THEN ' +
            'END; ' +
            'END LOOP; ' +
            'ELSIF ach_name = \'Set unlocked\' ' +
            'THEN ' +
            'INSERT INTO ' + TABLES.USERS_ACHIEVEMENTS + '(game_profile_id, achievements_id, item_id, count) ' +
            'SELECT gid, aid, item, 1 ' +
            'WHERE ' +
            'NOT EXISTS (SELECT id FROM ' + TABLES.USERS_ACHIEVEMENTS + ' WHERE game_profile_id = gid AND achievements_id = aid AND item_id = item); ' +
            'IF found THEN ' +
            'UPDATE ' + TABLES.GAME_PROFILE + ' SET points_number = points_number + a_prize ' +
            'WHERE id = gid; ' +
            'END IF; ' +
            'ELSIF ach_name = \'Smash unlocked\' ' +
            'THEN ' +
            'INSERT INTO ' + TABLES.USERS_ACHIEVEMENTS + '(game_profile_id, achievements_id, item_id, count) ' +
            'SELECT gid, aid, item, 1 ' +
            'WHERE ' +
            'NOT EXISTS (SELECT id FROM ' + TABLES.USERS_ACHIEVEMENTS + ' WHERE game_profile_id = gid AND achievements_id = aid AND item_id = item); ' +
            'IF found THEN ' +
            'UPDATE ' + TABLES.GAME_PROFILE + ' SET points_number = points_number + a_prize*set ' +
            'WHERE id = gid; ' +
            'END IF; ' +
            'ELSE ' +
            'INSERT INTO ' + TABLES.USERS_ACHIEVEMENTS + '(game_profile_id, achievements_id, count) ' +
            'SELECT gid, aid, 1 ' +
            'WHERE ' +
            'NOT EXISTS (SELECT id FROM ' + TABLES.USERS_ACHIEVEMENTS + ' WHERE game_profile_id = gid AND  achievements_id = aid); ' +
            'IF found THEN ' +
            'UPDATE ' + TABLES.GAME_PROFILE + ' SET points_number = points_number + a_prize*set, ' +
            'stars_number = ( ' +
            'CASE WHEN ach_name = \'Connection to Facebook\' ' +
            'THEN stars_number + 500 ' +
            'ELSE stars_number ' +
            'END) ' +
            'WHERE id = gid; ' +
            'END IF; ' +
            'END IF; ' +
            'END; ' +
            '$$ ' +
            'LANGUAGE plpgsql'
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
    }

    function activateBooster(cb) {
        knex.raw(
            'CREATE OR REPLACE FUNCTION activate_booster(guid uuid, booster INT) RETURNS TABLE (id int, left_flips int) AS ' +
            '$$ ' +
            'DECLARE quan INT;' +
            'BEGIN ' +
            'quan := (SELECT quantity FROM ' + TABLES.USERS_BOOSTERS + ' WHERE game_profile_id = guid AND booster_id = booster);' +

            'UPDATE ' + TABLES.USERS_BOOSTERS + '  SET is_active = true, quantity = quantity -1, flips_left = flips_left + 100 ' +
            'WHERE game_profile_id = ( ' +
            'SELECT g.id FROM game_profile g WHERE g.uuid = guid ' +
            ') AND booster_id = booster; ' +
            'RETURN QUERY SELECT booster_id, flips_left FROM ' + TABLES.USERS_BOOSTERS + ' WHERE game_profile_id = ( ' +
            'SELECT g.id FROM game_profile g WHERE g.uuid = guid' +
            ' ) AND booster_id = booster;' +
            'IF  quan < 0 OR quan ISNULL THEN ' +
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
    }

    function buyBooster(cb) {
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
    }

    function addFlips(cb) {
        knex.raw(
            'CREATE OR REPLACE FUNCTION add_flips(guid uuid,  quan INT, action_type INT) RETURNS VOID AS ' +
            '$$ ' +
            'BEGIN ' +
            'IF action_type <> 0 ' +
            'THEN ' +
            'UPDATE game_profile SET flips_number = flips_number + quan ' +
            'WHERE uuid = guid; ' +

            'ELSE ' +
            'UPDATE game_profile SET flips_number = ( ' +
            'CASE ' +
            'WHEN flips_number + quan > ' + CONSTANTS.DEFAULT_FLIPS_LIMIT + ' AND flips_number < ' + CONSTANTS.DEFAULT_FLIPS_LIMIT + '  THEN ' + CONSTANTS.DEFAULT_FLIPS_LIMIT + ' ' +
            'WHEN flips_number + quan > ' + CONSTANTS.DEFAULT_FLIPS_LIMIT + ' AND flips_number >= ' + CONSTANTS.DEFAULT_FLIPS_LIMIT + '  THEN flips_number ' +
            'ELSE flips_number + quan ' +
            'END ' +
            ') ' +
            'WHERE uuid = guid; ' +

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
    }

    function addFriends(cb) {
        knex.raw(
          'CREATE OR REPLACE FUNCTION add_friends(uid UUID, friends TEXT[]) ' +
          'RETURNS void AS ' +
          '$$ ' +
          'DECLARE gid INT := (SELECT id FROM ' + TABLES.GAME_PROFILE + ' WHERE uuid = uid); ' +
          'DECLARE friend RECORD; ' +
          'BEGIN ' +
          'DELETE FROM friends WHERE game_profile_id = gid; ' +
          'FOR friend IN (SELECT gp.id, up.facebook_id ' +
          'FROM ' + TABLES.GAME_PROFILE + ' gp LEFT JOIN ' + TABLES.USERS_PROFILE + ' up ON up.id = gp.user_id ' +
          'WHERE up.facebook_id = ANY (friends)) LOOP ' +
          'BEGIN ' +
          'INSERT INTO ' + TABLES.FRIENDS + '(game_profile_id, friend_game_profile_id) VALUES (gid, friend.id); ' +
          'END; ' +
          'END LOOP; ' +
          'END; ' +
          '$$ ' +
          'LANGUAGE plpgsql '
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
    }

    function removeSmashes(cb) {
        knex.raw(
            'CREATE OR REPLACE FUNCTION remove_smashes(guid UUID, sids INT[] ) RETURNS VOID AS ' +
            '$$ ' +
            'DECLARE smash RECORD; ' +
            'DECLARE gid INT := (SELECT id FROM game_profile WHERE uuid = guid); ' +
            'BEGIN ' +
            'FOR smash IN SELECT * FROM smashes WHERE id = ANY (sids) LOOP ' +
            'BEGIN ' +
            'IF (SELECT quantity FROM users_smashes WHERE game_profile_id = gid AND smash_id = smash.id) = 0 ' +
            'THEN RAISE EXCEPTION \'YOU CAN NOT REMOVE THIS SMASH\'; ' +
            'ELSE UPDATE users_smashes SET quantity = quantity - 1 ' +
            'WHERE game_profile_id = gid AND smash_id = smash.id; ' +
            'END IF; ' +
            'END; ' +
            'END LOOP; ' +
            'RETURN; ' +
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
    }

    function addSmashes(cb) {
        knex.raw(
            'CREATE OR REPLACE FUNCTION add_smashes(guid UUID, sids INT[] ) RETURNS VOID AS ' +
            '$$ ' +
            'DECLARE smash RECORD; ' +
            'DECLARE gid INT := (SELECT id FROM game_profile WHERE uuid = guid); ' +
            'BEGIN ' +
            'FOR smash IN SELECT * FROM smashes WHERE id = ANY (sids) LOOP ' +
            'BEGIN ' +
            'LOOP ' +
            'UPDATE users_smashes SET quantity = quantity + 1   WHERE game_profile_id = gid AND smash_id = smash.id; ' +
            'IF found THEN ' +
            'EXIT; ' +
            'END IF; ' +
            'BEGIN ' +
            'INSERT INTO users_smashes(game_profile_id, smash_id, quantity) VALUES (gid, smash.id, 1); ' +
            'EXIT; ' +
            'EXCEPTION WHEN unique_violation THEN ' +
            'END; ' +
            'END LOOP; ' +
            'END; ' +
            'END LOOP; ' +
            'RETURN; ' +
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
    }

    function UUIDExtension(cb) {
        knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
            .then(function () {
                cb()
            })
            .catch(cb)
    }

    function countriesTable(cb) {
        createTable(TABLES.COUNTRIES, function (row) {
            row.increments('id').primary();
            row.string('iso_code').notNullable();
            row.string('name').notNullable();

            row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
            row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
        }, cb)
    }

    function languageTable(cb) {
        createTable(TABLES.LANGUAGE, function (row) {
            row.increments('id').primary();
            row.string('iso_code').notNullable();
            row.string('name').notNullable();

            row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
            row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
        }, cb)
    }

    function userTable(cb) {
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
    }

    function fbNotifTable(cb) {
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

    }

    function deviceTable(cb) {
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
    }

    function gameProfileTable(cb) {
        createTable(TABLES.GAME_PROFILE, function (row) {
            row.increments('id').primary();
            row.uuid('uuid').defaultTo(knex.raw('uuid_generate_v4()')).index();
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
            row.integer('game_rate_point').defaultTo(0);
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
            row.timestamp('last_seen_date', true).defaultTo(knex.raw('now()'));
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
    }

    function boosterTable(cb) {
        createTable(TABLES.BOOSTERS, function (row) {
            row.increments('id').primary();
            row.string('name');
        }, cb)
    }

    function usersBoosterTable(cb) {
        createTable(TABLES.USERS_BOOSTERS, function (row) {
            row.increments('id').primary();
            row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('CASCADE').onUpdate('CASCADE');
            row.integer('booster_id').references('id').inTable(TABLES.BOOSTERS).onDelete('CASCADE').onUpdate('CASCADE');
            row.boolean('is_active').defaultTo(false);
            row.integer('flips_left').defaultTo(0);
            row.integer('quantity').defaultTo(1);

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
    }

    function friendsTable(cb) {
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
    }

    function smashesTable(cb) {
        createTable(TABLES.SMASHES, function (row) {
            row.increments('id').primary();
            row.string('name', 50).notNullable();
            row.integer('set').notNullable();

            row.timestamp('updated_at', true).defaultTo(knex.raw('now()'));
            row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
        }, cb)
    }

    function usersSmashestable(cb) {
        createTable(TABLES.USERS_SMASHES, function (row) {
            row.increments('id').primary();
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
    }

    function achivementsTable(cb) {
        createTable(TABLES.ACHIEVEMENTS, function (row) {
            row.increments('id').primary();
            row.string('name').notNullable();
            row.integer('type').notNullable();
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
    }

    function usesAchivementsTable(cb) {
        createTable(TABLES.USERS_ACHIEVEMENTS, function (row) {
            row.increments('id').primary();
            row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('CASCADE').onUpdate('CASCADE');
            row.integer('achievements_id').references('id').inTable(TABLES.ACHIEVEMENTS).onDelete('CASCADE').onUpdate('CASCADE');
            row.integer('item_id');
            row.integer('count');

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
    }

    function invitesTable(cb) {
        createTable(TABLES.INVITES, function (row) {
            row.increments('id').primary();
            row.integer('game_profile_id').references('id').inTable(TABLES.GAME_PROFILE).onDelete('CASCADE').onUpdate('CASCADE');
            row.string('invite_id');

            row.timestamp('created_at', true).defaultTo(knex.raw('now()'));
        }, cb)
    }

    function kioskTable(cb) {
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
    }

    function usersPurchaseTable(cb) {
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
    }

    function notifQueueTable(cb) {
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
    }

    function notifHistoryTable(cb) {
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

    function createFunctions() {

        async.series([
            calcRate,
            singleGame,
            addFriends,
            achievementFunc,
            activateBooster,
            buyBooster,
            addFlips,
            removeSmashes,
            addSmashes

        ], function (errors) {

            if (errors) {
                console.log('===============================');
                console.log(errors);
                console.log('===============================');

            } else {
                console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
                console.log('Functions Created!');
                console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');

            }
        })
    }

    function createTables() {
        async.series([
            UUIDExtension,
            triggerUpdateDate,
            triggerDeleteExpBooster,
            triggerDesactivateBooster,
            countriesTable,
            languageTable,
            userTable,
            fbNotifTable,
            deviceTable,
            gameProfileTable,
            boosterTable,
            usersBoosterTable,
            invitesTable,
            friendsTable,
            smashesTable,
            usersSmashestable,
            achivementsTable,
            usesAchivementsTable,
            kioskTable,
            usersPurchaseTable,
            notifQueueTable,
            notifHistoryTable

        ], function (errors) {
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
                dropTable(TABLES.INVITES, cb)
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

    function fillPurchasePack(cb) {

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
            .exec(function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
    }

    function fillSmashes(cb) {
        var sqlString = "CREATE OR REPLACE FUNCTION fillSmashes() RETURNS VOID AS $$ " +
            " DECLARE counter INT := 1;" +
            " BEGIN " +
            " DELETE FROM " + TABLES.SMASHES + ";" +
            " WHILE (counter <= " + CONSTANTS.SMASHES_LIMIT + ") LOOP " +
            " INSERT INTO " + TABLES.SMASHES + " (id, name, set) VALUES (counter, 'SMASH ' || counter, (((counter - 1) / " + CONSTANTS.SMASHES_PER_SET + " ) | 0) + 1); " +
            " counter := counter + 1; " +
            " END LOOP; " +
            " END; " +
            " $$ LANGUAGE plpgsql; ";

        knex
            .raw(sqlString)
            .exec(function (err) {
                if (err) {

                    return cb(err);

                }

                cb(null);

            });

    }

    function fillBoosters(cb) {
        var sqlString = " CREATE OR REPLACE FUNCTION fillBoosters() RETURNS VOID AS $$ " +
            " BEGIN " +
            " DELETE FROM " + TABLES.BOOSTERS + ";" +
            " INSERT INTO " + TABLES.BOOSTERS + " (id, name) VALUES " +
            " (1, 'slow_strength_bar'), " +
            " (2, 'slow_aiming_bar'), " +
            " (3, 'double_gold_rewards'); " +
            " END; " +
            " $$ LANGUAGE plpgsql; ";

        knex
            .raw(sqlString)
            .exec(function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            })
    }

    function fillAchievements(cb) {
        var sqlString = " CREATE OR REPLACE FUNCTION fillAchievements() RETURNS VOID AS $$ " +
            " BEGIN " +
            " DELETE FROM " + TABLES.ACHIEVEMENTS + ";" +
            " INSERT INTO " + TABLES.ACHIEVEMENTS + " (id, name, type, prize) VALUES " +
            " (1, \'" + CONSTANTS.ACHIEVEMENTS.SUPER_FLIP.NAME + "\', " + CONSTANTS.ACHIEVEMENTS_TYPES.MULTIPLE + ", " + CONSTANTS.ACHIEVEMENTS.SUPER_FLIP.POINTS + "), " +
            " (2, \'" + CONSTANTS.ACHIEVEMENTS.PURCHASE.NAME + "\', " + CONSTANTS.ACHIEVEMENTS_TYPES.MULTIPLE + ", " + CONSTANTS.ACHIEVEMENTS.PURCHASE.POINTS + "), " +
            " (3, \'" + CONSTANTS.ACHIEVEMENTS.FB_CONNECT.NAME + "\', " + CONSTANTS.ACHIEVEMENTS_TYPES.ONE_TIME + ", " + CONSTANTS.ACHIEVEMENTS.FB_CONNECT.POINTS + "), " +
            " (4, \'" + CONSTANTS.ACHIEVEMENTS.SMASH_UNLOCK.NAME + "\', " + CONSTANTS.ACHIEVEMENTS_TYPES.ONE_TIME + ", " + CONSTANTS.ACHIEVEMENTS.SMASH_UNLOCK.POINTS + "), " +
            " (5, \'" + CONSTANTS.ACHIEVEMENTS.FRIEND_CHALLENGE.NAME + "\', " + CONSTANTS.ACHIEVEMENTS_TYPES.MULTIPLE + ", " + CONSTANTS.ACHIEVEMENTS.FRIEND_CHALLENGE.POINTS + "), " +
            " (6, \'" + CONSTANTS.ACHIEVEMENTS.WIN.NAME + "\', " + CONSTANTS.ACHIEVEMENTS_TYPES.MULTIPLE + ", " + CONSTANTS.ACHIEVEMENTS.WIN.POINTS + "), " +
            " (7, \'" + CONSTANTS.ACHIEVEMENTS.WINS_3.NAME + "\', " + CONSTANTS.ACHIEVEMENTS_TYPES.MULTIPLE + ", " + CONSTANTS.ACHIEVEMENTS.WINS_3.POINTS + "), " +
            " (8, \'" + CONSTANTS.ACHIEVEMENTS.COME_BACK_1_DAY.NAME + "\', " + CONSTANTS.ACHIEVEMENTS_TYPES.MULTIPLE + ", " + CONSTANTS.ACHIEVEMENTS.COME_BACK_1_DAY.POINTS + "), " +
            " (9, \'" + CONSTANTS.ACHIEVEMENTS.COME_BACK_1_WEEK.NAME + "\', " + CONSTANTS.ACHIEVEMENTS_TYPES.MULTIPLE + ", " + CONSTANTS.ACHIEVEMENTS.COME_BACK_1_WEEK.POINTS + "), " +
            " (10, \'" + CONSTANTS.ACHIEVEMENTS.INVITE.NAME + "\', " + CONSTANTS.ACHIEVEMENTS_TYPES.MULTIPLE + ", " + CONSTANTS.ACHIEVEMENTS.INVITE.POINTS + "), " +
            " (11, \'" + CONSTANTS.ACHIEVEMENTS.SET_UNLOCK.NAME + "\', " + CONSTANTS.ACHIEVEMENTS_TYPES.ONE_TIME + ", " + CONSTANTS.ACHIEVEMENTS.SET_UNLOCK.POINTS + "); " +
            " END; " +
            " $$ LANGUAGE plpgsql; ";

        knex
            .raw(sqlString)
            .exec(function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            })
    }


    function setDefaultOptions() {

        async.parallel([
            fillPurchasePack,
            fillSmashes,
            fillBoosters,
            fillAchievements

        ], function (err) {
            if (err) {
                console.log('===============================');
                console.log(err);
                console.log('===============================');
            } else {

                async.series([
                    function (cb) {
                        knex
                            .raw(" SELECT fillSmashes(); ")
                            .exec(cb);
                    },

                    function (cb) {
                        knex
                            .raw(
                            " DELETE FROM " + TABLES.KIOSK + " WHERE store = 'APPLE'; " +
                            " SELECT fillPacks('APPLE'); "
                        )
                            .exec(cb);
                    },

                    function (cb) {
                        knex
                            .raw(
                            " DELETE FROM " + TABLES.KIOSK + " WHERE store = 'GOOGLE'; " +
                            " SELECT fillPacks('GOOGLE'); "
                        )
                            .exec(cb);
                    },

                    function (cb) {
                        knex
                            .raw(" SELECT fillBoosters(); ")
                            .exec(cb)
                    },

                    function (cb) {
                        knex
                            .raw(" SELECT fillAchievements(); ")
                            .exec(cb)
                    }

                ], function (err) {
                    if (err) {

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
        create: createTables,
        createFunctions: createFunctions,
        drop: drop,
        setDefaultData: setDefaultOptions
    }
};