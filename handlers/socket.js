
var async = require('async');
var _ = require('lodash');
var uuid = require('uuid');
var debug = require('debug')('custom:socket:events');
var client = (new (require('../helpers/redisStore'))).client;
/* CONSTANTS */
var SEARCH_TTL = 300;
var SMASH_STACK_MAX_OFFSET = 0.2;
var TURN_TTL = 300;
var TIME_TO_REVENGE = 300;

function eventError( err, socket ) {
    "use strict";
    socket.emit(
        'eventError',
        {
            sourceEvent: err.sourceEvent,
            message: err.message
        }
    );
}

function arrDiff( arr1, arr2 ) {
    "use strict";
    var length;

    for (length = arr2.length; length--;) {
        arr1.splice( arr1.indexOf( arr2[length] ) , 1 );
    }

    return arr1;
}

function getOpponent( uId, bet, callback ) {
    var isFind = false;
    var response;

    async.doUntil(
        function( dCb ) {
            var queueKey = ':queue:'+bet+':';

            client.lpop( queueKey, function( err, queueData ) {
                var searchKey;

                if ( err ) {
                    return dCb(err);
                }

                if ( queueData && queueData !== uId ) {
                    searchKey = ':search:'+ queueData + ':';
                    client.hgetall( searchKey, function( err, searchData ) {
                        if ( err) {
                            return dCb( err );
                        }

                        if ( searchData ) {
                            isFind = true;
                            response = { uId: queueData };
                            try {
                                _.forEach( searchData, function(value, key) {
                                    "use strict";
                                    response[key] = JSON.parse( value );
                                });
                            } catch( err ) {
                                return dCb(err);
                            }

                        }

                        return dCb()
                    })
                }

                if ( !queueData ) {
                    isFind = true;
                    return dCb();
                }

            })
        },
        function() {
            return isFind;
        },

        function(err) {
            if (err) {
                return callback( err );
            }

            callback( null, response );
        }
    )
}

function smashOffset( maxOffset ) {

    return ( 1-2*Math.random() ) * maxOffset;

}

function getRandomUser( users ) {

    return users[ Math.floor( Math.random() * users.length ) ];

}

function createGameId( userIdArr ) {
    /*return ':'+ userIdArr.sort().join(':') + ':';*/
    return uuid.v4();
}

function createGame( user1Data, user2Data, callback ) {
    "use strict";
    var users = [ user1Data.uId, user2Data.uId ]; // [ userId ]
    var stack = user1Data.stack.concat( user2Data.stack ); // [ smashId ]node

    var currentStack = _.shuffle(_.map( stack, function( value ) {
        return {
            id: value,
            x: ( smashOffset( SMASH_STACK_MAX_OFFSET )).toFixed(5),
            y: ( smashOffset( SMASH_STACK_MAX_OFFSET )).toFixed(5)
        }

    } ));

    var gameData = {
        id: createGameId( users ),
        stack: currentStack,
        users: users,
        currentUser: getRandomUser( users ),
        ttl: TURN_TTL
    };


    for (var i = gameData.users.length; i--;) {
        gameData[gameData.users[i]] = []; //TODO posible uid confilct with object keys
    }

    var insObj = {};

    _.forEach(gameData, function(val, key) {
        insObj[key] = JSON.stringify(val);
    });

    var gameKey = ':game:' + gameData.id + ':';

    client.hmset( gameKey, insObj, function( err, data ) {
        if (err) {
            return callback( err );
        }

        callback( null, gameData );
    });

}

/*function handShake( socket, next ) {
    "use strict";

    var uId = socket.handshake.query.userId;

    if ( uId ) {
        socket.uId = uId;
    } else {
        socket.disconnect();
    }

    next();

}*/

module.exports = function( httpServer ) {
    "use strict";
    var io = require('../helpers/socket')(httpServer);


    io.on('connection', function( socket ) {
        var uId = socket.handshake.query.uId;

        if ( ! uId ) {
            debug('socket ' + socket.id + ' disconnected: no uId');
            return socket.disconnect();
        }

        socket.join(uId);

        socket.uId = uId;

        debug('socket ' + socket.id + ' connected. uId: ' + uId );

        socket.on('startSearch', function( data ) {
            /* TODO: add validation */
            var uId = socket.uId;
            var bet = parseInt( data.bet ) | 0;
            var stack = data.stack;

            /* add search record */
            ( function( uId, bet, stack ) {



                async.waterfall([

                        function(wCb) {
                            var key = ':search:'+ uId + ':';

                            client.hsetnx(key, 'socketId', JSON.stringify(socket.id), wCb);
                        },

                        function( data, wCb ) {
                            var key = ':search:'+ uId + ':';
                            var multi;
                            var err = {};


                            if ( !data ) {

                                err.message = 'Other device in search';
                                err.custom = true;
                                err.sourceEvent = 'startSearch';
                                debug(socket.id + ': Other device in search');

                                return wCb( err );
                            }

                            multi = client.multi();

                            multi.hmset(
                                key,
                                {
                                    stack: JSON.stringify( stack ),
                                    bet: bet
                                }
                            );

                            multi.expire( key, SEARCH_TTL );

                            multi.exec( wCb );
                        },

                        function(data, wCb) {

                            getOpponent( uId, bet, function ( err, opponentData ) {
                                var queueKey = ':queue:'+bet+':';

                                if (err) {
                                    return wCb( err );
                                }

                                if ( !opponentData ) {
                                    client.rpush( queueKey, uId, function( err, data) {
                                        if (err) {
                                            return console.log(err);
                                        }
                                         console.log('Added to Queue: ', bet, ' uId: ', socket.uId );
                                    });
                                    socket.emit('addToQueue', { ttl: SEARCH_TTL });
                                    return wCb();

                                }


                                console.log('CreateGame');
                                createGame(
                                    { bet: bet, uId: uId, stack: stack },
                                    { bet: opponentData.bet, uId: opponentData.uId, stack: opponentData.stack },
                                    function( err, gameData ) {
                                        var result;

                                        if (err) {
                                            return console.log( err );
                                        }

                                        if ( !gameData ) {
                                            return console.log( 'No game data' );
                                        }

                                        result = {
                                            id: gameData.id,
                                            stack: gameData.stack,
                                            users: gameData.users,
                                            currentUser: gameData.currentUser,
                                            ttl: gameData.ttl
                                        };

                                        for (var i = result.users.length; i--;) {
                                            console.log('st emit: ', result.users[i]);
                                            io.to(result.users[i]).emit('startGame', JSON.stringify( result ) );
                                        }

                                        wCb( null, result );
                                    }
                                )



                            });
                        }

                    ],

                    function( err, result ) {
                        if ( err && err.custom ) {
                            return eventError(err, socket);
                        }

                        if ( err ) {
                            err.message = 'Server Error';
                            err.custom = true;
                            err.sourceEvent = 'startSearch';
                            return eventError( err, socket );
                        }

                    }
                );

                /*client.setnx(
                    ':search:'+ uId + ':',
                    JSON.stringify({ bet: bet, stack: stack }),
                    function( err, result ){
                        if (err) {
                            return debug( err.message || err );
                        }

                        if ( !result) {
                            return socket.emit('err', { message: 'other devise search'});
                        };

                        /!* set search record expiration  *!/
                        client.expire(':search:'+ uId + ':', 30);
                        socket.emit('message', {message: 'added to search queue'});
                    }
                );*/
            })( uId, bet, stack )

        });

        socket.on('stopSearch', function( data ) {

            /*async.waterfall(
                async.apply(client.get, ':search:'+ uId + ':'),
                function( data, wCb ) {
                    if ( data ) {}
                }
            );*/

            /* del search record */
            (function( uId ){
                client.del(
                    ':search:'+ uId + ':',
                    function() {
                        socket.emit('endSearch', {message: 'Success'});
                    }
                )
            })(socket.uId);
        });

        socket.on('trajectory', function(data) {
            var gameId = data.gId;
            var gameKey = ':game:' + gameId + ':';

            client.hget(gameKey, 'users', function(err,data) {
                var users;
                if (err) {
                    return eventError( err, socket );
                }

                try {
                    users = JSON.parse( data );
                } catch(err) {
                    return eventError( err, socket );
                }


            });

            socket.to(gameId).emit( 'trajectory', data );
        });

        socket.on('joinGame', function(){})

        socket.on('angle', function(data) {
            var gameId = data.gId;

            socket.to(gameId).emit( 'angle', data );
        });

        socket.on('strength', function() {
            var gameId = data.gId;

            socket.to(gameId).emit( 'strength', data );

        });

        socket.on('winStack', function( data ) {
            var uId = socket.uId;
            var gameId = data.gId;
            var gameKey = ':game:' + gameId + ':';
            var stack;

            try {
                stack = JSON.parse( data.stack );
            } catch(err) {
                 return console.log(err); //TODO
            }

            client.hgetall( gameKey, function( err, data) {
                var gameData = {};
                var stack;

                if (err) {
                    return console.log( err );
                }

                try {
                    _.forEach(data, function(val, key) {
                        gameData[key] = JSON.parse(val);
                    });
                    stack = JSON.parse( data.stack );
                } catch(err) {
                    console.log( err );
                }

                gameData[socket.uId].concat( stack );

                arrDiff( gameData.stack, stack );

                if ( !gameData.stack.length ) {

                    socket.to(gameId).broadcast(
                        'endGame',
                        {
                            user1: gameData[gameData.users[0]],
                            user2: gameData[gameData.users[0]],
                            users: gameData.users,
                            timeToRevemge: TIME_TO_REVENGE
                        }
                    );
                }
            })
        });


        socket.on('disconnect', function() {
            debug(socket.id + ', uId: '+ socket.id + 'disconnect');

        });

    });
};

