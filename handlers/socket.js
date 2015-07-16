/**
 * Created by eriy on 09.07.15.
 */

var sockets = require('socket.io');
var redisObject = require('../helpers/redisClient')();
var RedisSocketStore = require( 'socket.io/lib/stores/redis' );
var logger = require('../helpers/logger');
var io;

var Socket = function( server, app ) {
    if ( io ) {
        return io;
    }

    io = sockets.listen(
        server,
        {
            store: new RedisSocketStore( redisObject )
        }
    );

    io.configure( function () {
        io.set( "transports", ["websocket"] );
        io.set( 'log level', 0 );
        //io.set("polling duration", 10);
    } );

    io.sockets.on('connection', function (socket) {
        logger.info(
            'Socket connected',
            {
                cluster: process.env.pm_id,
                socketId: socket.id
            }
        );

        socket.on('test', function(data){
            var rabbit = app.get('rabbit');
            rabbit.publishMessage( 'testEvent', { message: 'Hello world', socket: socket.id }, 'test.event', function( err ) {
                if (err) {
                    return console.log('Error: test rabbitMQ');
                }

                console.log('Success: test rabbitMQ')
            });
            socket.emit('test', data );
            logger.info(
                'Incoming test message',
                {
                    cluster: process.env.pm_id,
                    socketId: socket.id,
                    data: data
                }
            );
        });

        socket.on('newStack', function(data) {
            if ( data && data.stack && data.stack instanceof Array ) {

            }


        });

        socket.emit('info', { message: 'connected', socket: socket.id });

        socket.on('join', function( inData ) {
            var data = {room: 'Data'};
            if ( data && data.room ) {
                socket.join( data.room );
                socket.emit( 'info', { message: 'Connected to ROOM: ', room: data.room, socket: socket.id } );
                socket.broadcast.to( 'room1' ).emit(
                    'info ',
                    {
                        message: 'New Participiant Connected',
                        newSocket: socket.id,
                        room: data.room
                    }
                )
            } else {
                socket.emit(
                    'info',
                    {
                        message: 'Error',
                        error: 'Bad Data'
                    }
                );
            }

        });

        socket.on('leave', function( data ) {

            if (data && data.room) {
                socket.leave( data.room );
                socket.emit( 'info', { message: 'Leave ROOM: ' + data.room, socket: socket.id } );
                return socket.broadcast.to( data.room ).emit(
                    'info ',
                    {
                        message: 'Participiant Disconnected',
                        oldSocket: socket.id,
                        room: data.room
                    }
                );
            }


        });

        socket.on('getRoom', function( data ) {
            var util = require('util');
            if (data && data.room) {
                socket.emit(
                    'info',
                    {
                        message: 'ROOM Parcipiants',
                        parcipiants: util.inspect(io.sockets.clients( data.room ))
                    }
                );
            }

        });

        socket.on( 'sendRoom', function( data ) {

            var util = require('util');
            if (data && data.room) {
                socket.broadcast.to('room1').emit(
                    'info',
                    {
                        message: 'ROOM message',
                        parcipiants: socket.id
                    }
                );
            }

        } );

        socket.on('writeRound', function () {
            redisObject.cacheStore.writeToStorage('round', socket.id  );
        });

        socket.on('readRound', function () {
            redisObject.cacheStore.readFromStorage('round', function(err, value ) {
                if (err) {
                    return logger.error('Redis error')
                }

                console.log( socket.id , ':', value )
            })
        });

        /* connecting to room identified by game id */
        socket.on('connectGame', function( data ) {
            var gameId;

            if ( !data || ! data.gameId || typeof data.gameId !== 'string') {
                return logger.error(
                    'Bad Input Data',
                    {
                        event: 'connectGame',
                        direction: 'in',
                        cluster: process.env.pm_id,
                        socketId: socket.id
                    }
                );
            }

            gameId = data.gameId;

            socket.join( gameId );

            socket.emit( 'info', {
                message: 'connected to Game',
                gameId: gameId
            } );

            socket.broadcast.to( data.gameId ).emit('info', {
                message: 'user connected',
                socketId: socket.id,
                game: gameId
            })

        });

        socket.on('disconnect', function() {
            logger.info(
                'Socket disConnected',
                {
                    cluster: process.env.pm_id,
                    socketId: socket.id
                }
            );
        })
    });

    return io;
};

module.exports = Socket;