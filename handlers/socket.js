/**
 * Created by eriy on 09.07.15.
 */

/*var sockets = require('socket.io');
var redisObject = require('../helpers/redisClient')();
var RedisSocketStore = require( 'socket.io/lib/stores/redis' );*/
var logger = require('../helpers/logger');
var sharedSession = require("express-socket.io-session");
var redis = require( 'socket.io-redis' );
var io;

var Socket = function( server, app ) {
    if ( io ) {
        return io;
    }
    var sessionStore = app.get('sessionStore');

    io = require('socket.io')(
        server,
        {
            transports: ['websocket']
        }
    );

    io.adapter( redis({
        /*host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT*/
    }) );

    io.use( sharedSession( sessionStore, { autoSave: true } ) );
    io.use( function( socket, next ) {
        var err;

        if ( ! socket.handshake.session.uId ) {
            err = new Error({ message: 'unAuthorized', socketId: socket.id });
            err.status = 403;

            if ( process.env.NODE_ENV === 'development') {
                console.log('Socket: ', socket.id, ' unAuthorized','\n', 'session: ', socket.handshake);
            }
            socket.emit('newMessage', { message: 'unAuthorized', socketId: 'system'});

            return next( err );
        }

        if ( process.env.NODE_ENV === 'development') {
            console.log('Socket: ', socket.id, ' isAuthorized, UserId: ', socket.handshake.session.uId);
        }

        next();
    });

    io.on('connection', function( socket ) {
        socket.emit('newMessage', { message: 'you are connected', socketId: socket.id });
        console.log(
            'Socket connected: ', socket.id, '\n',
            'session: ', socket.handshake.session
        );

        socket.on('newMessage', function( data ) {
            if ( data.room ) {
                console.log( data.room );
                socket.broadcast.to( data.room ).emit('newMessage', { message: data.message, socketId: socket.handshake.session.user ||socket.id } );
                console.log( 'New message\n', 'from: ', socket.id, '\n', 'to room: ', data.room );
            } else {
                socket.emit('newMessage', { message: 'your test msg resived', data: data, socketId:socket.handshake.session.user || socket.id });
            }

        });

        socket.on('user:login', function( data ) {
            if ( data.room ) {
                console.log( data.room );
                socket.broadcast.to( data.room ).emit('newMessage', { message: data.message, socketId: socket.handshake.session.user ||socket.id } );
                console.log( 'New message\n', 'from: ', socket.id, '\n', 'to room: ', data.room );
            } else {
                console.log('Socket IN: ', socket.id, ' Data: ', data);
                socket.emit('newMessage', { message: 'your test msg resived', data: data, socketId:socket.handshake.session.user || socket.id });
            }

        });

        socket.on('join', function( data ) {
            socket.join( data.room );
            socket.handshake.session.user = data.room;
            socket.emit('newMessage', {message: 'You are joined', room: data.room, socketId: 'ROOM-' + data.room + ': ' });
            io.sockets.to( data.room ).emit('newMessage', {message: 'New user connected: ' + socket.id, socketId: 'ROOM-' + data.room + ': '})
        });

        socket.on('disconnect', function() {
            socket.broadcast.emit('newMessage', { message: 'user disconnected ', socketId: socket.id } );
            console.log('Socket disconnected: ', socket.id );
        })

    });

    return io;
};

module.exports = Socket;