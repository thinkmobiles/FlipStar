/**
 * Created by eriy on 22.07.15.
 */
var redis = require('redis');
var _ = require('lodash');
var gameMaxTTL = 60 * 30;

module.exports = function() {
    var self = this;
    var client = redis.createClient(
        /*parseInt( process.env.REDIS_PORT )*/ 6379,
        /*process.env.REDIS_HOST*/ 'localhost'
    );
    /* discuse : select can later execute, factory -> Constructor */
    client.select( /*process.env.REDIS_DB*/ 3, function( err ) {
        if ( err ) {
            throw new Error( err );
        }

        /*self.writeToStorage = function ( data ) {
            "use strict";
            client.set( key, value, redisSocketIo.print );

        };

        self.readFromStorage = function ( data, callback ) {

            client.get( key, callback );

        }*/
    });

    function writeToStorage ( key, data, value, callback ) {
        "use strict";
        var multi = client.multi();

        if ( data && typeof data === 'object') {
            callback = value;
            multi.
                hmset( key, _.mapValues( data, function( value ) {

                /*if (typeof value === 'object') {*/
                    return JSON.stringify( value );
/*                }

                return value;*/

                }));

        } else {
            multi.hset( key, data, JSON.stringify( value ) );
        }

        multi.
            expire( key, gameMaxTTL ).
            exec( callback )
    };

    /* TODO handle JSON.parse errors */
    function readFromStorage ( key, data, callback ) {
        "use strict";

        var dataType = typeof data;

        if ( dataType === 'function') {

            callback = data;

            return client.hgetall( key, function( err, result ){

                callback( err, _.mapValues( result, function( value ) {
                    return JSON.parse( value );
                }) )

            })
        }

        if ( dataType === 'string' ) {

            return client.hget( key, data, function( err, result ) {
                callback( err, JSON.parse( result ) )
            });

        }

        if ( data instanceof Array ) {

            return client.hmget( key, data, function( err, result ){
                callback( err, _.zipObject( data, _.mapValues(result, function( value ) {
                    return JSON.parse( value );
                }) ) );
            })
        }

        /* TODO handle ass error if data type not acceptable */
        callback( null, null );

    }

    function findKeys( keyPattern, callback ) {
        client.keys( keyPattern, callback );
    }

    function delFromStorage( keys, callback ) {
        var keysArr;

        if ( typeof keys === 'string' ) {
            return client.del( keys, callback );
        }

    }

    return {
        findKeys: findKeys,
        readFromStorage: readFromStorage,
        writeToStorage: writeToStorage,
        delFromStorage: delFromStorage
    }
};
