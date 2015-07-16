module.exports = function () {
    var config = {
        db: parseInt( process.env.REDIS_DB ),
        host: process.env.REDIS_HOST,
        port: parseInt( process.env.REDIS_PORT )
    };
    var redisSocketIo = require( 'socket.io/node_modules/redis' );
    var pub = redisSocketIo.createClient( config.port, config.host, {} );
    var sub = redisSocketIo.createClient( config.port, config.host, {} );
    var client = redisSocketIo.createClient( config.port, config.host, {} );
    /*var _ = require( 'underscore' );*/

    client.select(config.db, function(err) {
        if(err){
            throw new Error(err);
        } else {
            console.log("----Select Redis DB With index = " + config.db);
        }
    });

    client.on( "error", function ( err ) {
        console.log( "Error " + err );
    } );

    client.on( "ready", function () {
        console.log( "Redis server  is now ready to accept connections on port " + process.env.REDIS_PORT );
    } );
    /*function CacheStore() {

        function writeToStorage( hash, key, value, needUpdateExistingKey ) {
            "use strict";
            if( !(value instanceof Array) ) {
                return client.hset( hash, key, value, redisSocketIo.print );
            }
            var firstEl = value[0];
            if(typeof firstEl === 'object' && firstEl.hasOwnProperty('_id')){
                value = _.pluck( value, "_id");
            }
            if( needUpdateExistingKey ) {
                client.hget( hash, key, function ( err, replies ) {
                    if( err ) {
                        throw new Error( err );
                    } else {
                        var array;
                        try {
                            array = JSON.parse( replies );
                        } catch ( exc ) {
                            array = [];
                        }
                        value = value.concat( array );
                        value = _.unique( value );
                        value = _.compact( value );
                        value = JSON.stringify( value );
                        client.hset( hash, key, value, redisSocketIo.print );
                    }
                } );
            } else {
                value = JSON.stringify( value );
                client.hset( hash, key, value, redisSocketIo.print );
            }
        }

        function readFromStorage( hash, key, callback ) {
            "use strict";
            client.hget( hash, key, function ( err, value ) {
                if( err ) {
                    throw new Error( err );
                } else {
                    try{
                        value = JSON.parse(value);
                    } catch (exc){
                        throw new Error(exc);
                    }
                    callback(value);
                }
            } );
        }

        function totalCount( key, callback ) {
            "use strict";
            var countHash = process.env.SEND_PUSH_HASH + ':' + key;
            readFromStorage(countHash, key, callback);
        }

        function incrementValue( hash, key, incrementValue ) {
            "use strict";
            client.hincrby( hash, key, incrementValue, redisSocketIo.print);
        }

        return {
            writeToStorage: writeToStorage,
            incrementValue: incrementValue,
            readFromStorage: readFromStorage,
            totalCount: totalCount
        }
    }*/
    function CacheStore() {

        function writeToStorage( key, value ) {
            "use strict";
            client.set( key, value, redisSocketIo.print )
        }

        function readFromStorage( key, callback ) {

            client.get( key, callback );

        }

        return {
            writeToStorage: writeToStorage,
            readFromStorage: readFromStorage
        }
    }

    return {
        redisPub: pub,
        redisSub: sub,
        redisClient: client,
        cacheStore: new CacheStore()
    };
};