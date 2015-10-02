/**
 * Created by eriy on 17.09.15.
 */

var redis = require( 'redis' );
var debug = require('debug')('handlers:socket');

var io;

function onError( err ) {
    "use strict";
    if ( err ) {
        return console.log( err.message || err );
    }
}

module.exports = function ( server ) {
    "use strict";

    if ( io ) {
        debug('Return cached socket.io');
        return io;
    }

    debug('Initialize socket.io');

    var adapter = require('socket.io-redis');
    var pub = redis.createClient(
        parseInt( process.env.SOCKET_DB_PORT ),
        process.env.SOCKET_DB_HOST,
        {
            return_buffers: true
        }
    );
    var sub = redis.createClient(
        parseInt( process.env.SOCKET_DB_PORT ),
        process.env.SOCKET_DB_HOST,
        {
            return_buffers: true
        }
    );

    io = require('socket.io')(
        server,
        {
            transports: ['websocket']
        }
    );

    io.adapter(
        adapter({
            pubClient: pub,
            subClient: sub
        })
    );

    /* Work only with engine.io source after commit df4331dd1a0a6c7f2c19ca13e6675e74fc431464*/
    /*io.engine.generateId = function( req ) {
     return (req._query.userId + (( Math.random() * 10 ) | 0 )) ;
     };*/

    pub.on('error', onError );
    sub.on('error', onError );

    return io;
};
