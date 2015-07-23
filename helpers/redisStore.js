/**
 * Created by eriy on 22.07.15.
 */
var redis = require('redis');
var _ = require('lodash');

module.exports = function() {
    var self = this;
    var client = redis.createClient(
        parseInt( process.env.REDIS_PORT ),
        process.env.REDIS_HOST
    );
    /* discuse : select can later execute, factory -> Constructor */
    client.select( process.env.REDIS_DB, function( err ) {
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

    function writeToStorage ( key, data ) {
        "use strict";
        if ( data && typeof data === 'object') {
            client.hmset( key, _.mapValues( data, function( value ) {

                if (typeof value === 'object') {
                    return JSON.stringify( value );
                }

                return value;

            }) )
        }

    };

    function readFromStorage ( data, callback ) {

        client.get( key, callback );

    }

    return {
        readFromStorage: readFromStorage,
        writeToStorage: writeToStorage
    }
};
