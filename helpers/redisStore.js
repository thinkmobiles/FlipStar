/**
 * Created by eriy on 22.07.15.
 */
var redis = require('redis');
var _ = require('lodash');

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

    function writeToStorage ( key, data, value ) {
        "use strict";

        if ( data && typeof data === 'object') {
            client.hmset( key, _.mapValues( data, function( value ) {

                /*if (typeof value === 'object') {*/
                    return JSON.stringify( value );
/*                }

                return value;*/

            }) )

        } else {
            client.hset( key, data, JSON.stringify( value ) );
        }

    };

    /* TODO handle JSON.parse errors */
    function readFromStorage ( key, data, callback ) {
        "use strict";

        var dataType = typeof data;

        if ( dataType === 'function') {

            callback = data;

            return client.hgetall( key, function( err, result ){

                callback( err, _.mapValues( result, function( value ) {
                    return JSON.parse( value )
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
        callback( null, {} );

    }

    return {
        readFromStorage: readFromStorage,
        writeToStorage: writeToStorage
    }
};
