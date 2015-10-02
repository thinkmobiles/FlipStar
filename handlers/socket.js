
var async = require('async');
var _ = require('lodash');
var uuid = require('uuid');
var debug = require('debug')('custom:socket:events');
var client = (new (require('../helpers/redisStore'))).client;
var GameProfHelper = require('../helpers/gameProfile');
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

function arrDiff( fromArray, removeArray ) {
    "use strict";
    var length;

    for (length = removeArray.length; length--;) {
        fromArray.splice( fromArray.indexOf( removeArray[length] ) , 1 );
    }

    return fromArray;
}

function arrUniqCountGroup(arr) {
    "use strict";
    var resultObject = {};
    var resultArray = [];
    var i;

    for (i = arr.length; i--;) {

        if ( resultObject[arr[i]] ) {
            resultObject[arr[i]] += 1;
        } else {
            resultObject[arr[i]] = 1;
        }
    }

    _.forOwn(resultObject, function(val, key) {
        return resultArray.push({
            id: key,
            quantity: val
        })
    });

    return resultArray;
}

function getOpponent( uId, bet, callback ) {
    var isFind = false;
    var response;

    async.until(
        /*repeat until isFind*/
        function() {
            return isFind;
        },

        /*get */
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

                            response = { uId: queueData };
                            try {
                                _.forEach( searchData, function(value, key) {
                                    "use strict";
                                    response[key] = JSON.parse( value );
                                });
                            } catch( err ) {
                                return dCb(err);
                            }

                            isFind = true;

                        }

                    })
                }

                if ( !queueData ) {
                    isFind = true;
                }

                dCb();

            })
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
    var currentStack = user1Data.stack.concat( user2Data.stack ); // [ smashId ]node

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
        console.log('createGame:NewGame:', gameData);
        callback( null, gameData );
    });

}

function getGame(gameId, callback) {
    "use strict";
    var gameKey = ':game:' + gameId + ':';

    client.hgetall( gameKey, function( err, gData) {
        var gameData = {};

        if (err) {
            return callback(err);
        }

        if (!gData) {
            return callback()
        }

        try {
            _.forEach(gData, function (val, key) {
                gameData[key] = JSON.parse(val);
            });
        } catch (err) {
            return callback(err);
        }

        callback(null, gameData);
    });

}

function stopSearch(userId, callback) {
    var searchKey = ':search:'+ userId + ':';

    client.del(searchKey, callback);

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

module.exports = function( httpServer, db ) {
    "use strict";
    var io = require('../helpers/socket')(httpServer);
    var gameProfHelper = new GameProfHelper(db);

    function endGame(gameData, callback) {
        var gameId = gameData.id;
        var leaver = gameData.leaver;
        var gameKey = ':game:' + gameId + ':';
        var endResponse;

        if (leaver) {
            gameData[leaver] = gameData[leaver].concat(gameData.stack);
        }

        endResponse = {
            id:    gameId,
            user1: gameData[gameData.users[0]],
            user2: gameData[gameData.users[1]],
            users: gameData.users,
            timeToRevenge: TIME_TO_REVENGE
        };

        client.del(gameKey, ':search:'+ gameData.users[0] + ':', ':search:'+ gameData.users[1] + ':', function(err) {
            console.log('multiplayer:endGame:Del:Game:', gameKey, '');
        });

        io.to( gameId ).emit(
            'endGame',
            endResponse
        );

        gameProfHelper.addSmashes({
            uid: endResponse.users[0],
            smashes: arrUniqCountGroup(endResponse['user1'])
        }, function(err) {
            if (err) {
                console.log('multiplayer:endGame:error', err); //TODO: handle error
            }
        });

        gameProfHelper.addSmashes({
            uid: gameData.users[1],
            smashes: arrUniqCountGroup(endResponse['user2'])
        }, function(err) {
            if (err) {
                console.log('multiplayer:endGame:error', err); //TODO: handle error
            }
        });

        callback();
    }

    /**
     *
     */
    io.on('connection', function( socket ) {

        console.log('Socket:Connect: ', socket.id);

        var uId = socket.handshake.query.uId;

        if ( ! uId ) {
            console.log('socket ' + socket.id + ' disconnected: no uId');
            return socket.disconnect();
        }

        socket.join(uId);

        socket.uId = uId;

        socket.on('startSearch', function( data ) {
            console.log('startSearch: START');
            /* TODO: add validation */
            var uId = socket.uId;
            var bet = parseInt( data.bet ) | 0;
            var stack = data.stack;
            var socketId = socket.id;

            /* add search record */
            ( function( uId, bet, stack, socketId ) {

                async.waterfall([

                        function(wCb) {
                            var searchKey = ':search:'+ uId + ':';

                            client.hsetnx(searchKey, 'socketId', JSON.stringify(socket.id), wCb);
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
                                    socket: JSON.stringify( socketId ),
                                    bet: bet
                                }
                            );

                            multi.expire( key, SEARCH_TTL );

                            multi.exec( wCb );
                        },

                        function(data, wCb) {

                            getOpponent( uId, bet, function ( err, opponentData ) {
                                var queueKey = ':queue:'+bet+':';
                                console.log('Opponent:', opponentData);
                                if (err) {
                                    return wCb( err );
                                }

                                if ( !opponentData ) {

                                    client.rpush( queueKey, uId, function( err, data) {
                                        if (err) {
                                            return wCb(err);
                                        }
                                         console.log('Added to Queue: ', bet, ' uId: ', socket.uId );
                                    });

                                    socket.emit('addToQueue', { ttl: SEARCH_TTL });
                                    socket.inSearch = true;

                                    return wCb();

                                }


                                createGame(
                                    { bet: bet, uId: uId, stack: stack },
                                    { bet: opponentData.bet, uId: opponentData.uId, stack: opponentData.stack },
                                    function( err, gameData ) {
                                        var result;

                                        if (err) {
                                            return wCb(err);
                                        }

                                        /*if ( !gameData ) {
                                            err = new Error('No game data');
                                            err.status = 409;
                                            return wCb(err);
                                        }*/

                                        var currentStack = _.shuffle(_.map( gameData.stack, function( value ) {
                                            return {
                                                id: value,
                                                x: ( smashOffset( SMASH_STACK_MAX_OFFSET )).toFixed(5),
                                                y: ( smashOffset( SMASH_STACK_MAX_OFFSET )).toFixed(5)
                                            }

                                        } ));

                                        result = {
                                            id: gameData.id,
                                            stack: currentStack,
                                            users: gameData.users,
                                            currentUser: gameData.currentUser,
                                            ttl: gameData.ttl
                                        };

                                        for (var i = result.users.length; i--;) {
                                            io.to(result.users[i]).emit('startGame', result );
                                        }

                                        wCb( null, result );
                                    }
                                )

                            });
                        }

                    ],
                    /*MAIN CALLBACK*/
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
            })( uId, bet, stack, socketId );

        });

        socket.on('stopSearch', function( data ) {
            var uId = socket.uId;

            stopSearch(uId, function(err){
                if (err) {
                    return console.log('ERROR:stopSearch: ', err);
                }
                socket.inSearch = false;
                socket.emit('endSearch', {message: 'Success'});
            });

            /*(function( uId ){
                client.del(
                    ':search:'+ uId + ':',
                    function() {
                        console.log('stopEnd: END');
                        socket.emit('endSearch', {message: 'Success'});
                    }
                )
            })(socket.uId);*/
        });

        socket.on('trajectory', function(data) {
            var gameId = socket.gId;
            /*var gameKey = ':game:' + gameId + ':';

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


            });*/

            socket.to(gameId).emit( 'trajectory', data );
        });

        socket.on('joinGame', function( data ){
            socket.gId = data.id ;
            socket.inGame = true;
            socket.join( socket.gId );
        });

        socket.on('angle', function(data) {
            var gameId = socket.gId;

            socket.to(gameId).emit( 'angle', data );
        });

        socket.on('strength', function( data ) {
            var gameId = socket.gId;

            socket.to(gameId).emit( 'strength', data );

        });

        socket.on('winStack', function( data ) {
            var uId = socket.uId;
            var gameId = socket.gId;
            var gameKey = ':game:' + gameId + ':';
            var stack = data.stack;


            async.waterfall(
                [
                    /*get game data*/
                    function (wCb) {
                        getGame(gameId, function(err, gData) {
                            if (err) {
                                return wCb(err);
                            }

                            if (!gData) {
                                err = new Error('Game dont exist');
                                err.status = 404;
                                return wCb(err);
                            }

                            wCb(null, gData);
                        });
                    },

                    /*handle data*/
                    function (gameData, wCb) {
                        var curUser;
                        var updateObject = {};

                        gameData[uId] = gameData[uId].concat( stack );
                        arrDiff( gameData.stack, stack );

                        if ( !gameData.stack.length ) {

                            return endGame(
                                gameData,
                                function(err, result) {
                                    if (err) {
                                        return wCb(err);
                                    }

                                    delete socket.gId;
                                    wCb();
                                }
                            );

                        } else {
                            curUser = gameData.users[(gameData.users.indexOf(gameData.currentUser) + 1 ) % 2];
                            updateObject.currentUser = JSON.stringify(curUser);
                            updateObject.stack = JSON.stringify(gameData.stack);
                            updateObject[socket.uId] = JSON.stringify( gameData[socket.uId] );

                            client.hmset(gameKey, updateObject, function(err, data) {
                                if (err) {
                                    return wCb(err);
                                }

                                var currentStack = _.shuffle(_.map( gameData.stack, function( value ) {
                                    return {
                                        id: value,
                                        x: ( smashOffset( SMASH_STACK_MAX_OFFSET )).toFixed(5),
                                        y: ( smashOffset( SMASH_STACK_MAX_OFFSET )).toFixed(5)
                                    }

                                } ));

                                io.to( gameId ).emit(
                                    'turnEnd',
                                    {
                                        id:             gameData.id,
                                        stack:          currentStack,
                                        users:          gameData.users,
                                        currentUser:    curUser,
                                        ttl:            gameData.ttl
                                    }
                                );

                                return wCb();
                            });
                        }


                    }
                ],
                function(err) {
                    if(err) {
                        return console.log('Error:winStack: ', err);
                    }


                }
            );

            /*client.hgetall( gameKey, function( err, gData) {
                var gameData = {};
                var curUser;
                var updateObject = {};

                if (err) {
                    return console.log( err );
                }

                try {
                    _.forEach(gData, function(val, key) {
                        gameData[key] = JSON.parse(val);
                    });
                } catch(err) {
                    console.log( err );
                }

                gameData[socket.uId] = gameData[socket.uId].concat( stack );
                console.log(gameData[socket.uId]);

                arrDiff( gameData.stack, stack );

                console.log( gameData.stack );

                if ( !gameData.stack.length ) {
                    return endGame(
                        gameData,
                        function(err, result) {
                            console.log('EndGame:normal:' + gameData.id);
                        }
                    );

                    /!*io.to( gameId ).emit(
                        'endGame',
                        {
                            id:    socket.gId,
                            user1: gameData[gameData.users[0]],
                            user2: gameData[gameData.users[1]],
                            users: gameData.users,
                            timeToRevenge: TIME_TO_REVENGE
                        }
                    );

                    client.del(gameKey,':search:'+ gameData.users[0] + ':', ':search:'+ gameData.users[1] + ':', function(err) {
                        console.log('multiplayer:endGame:del game data');
                    });

                    gameProfHelper.addSmashes({
                        uid: gameData.users[0],
                        smashes: arrUniqCountGroup(gameData[gameData.users[0]])
                    }, function(err) {
                        if (err) {
                            console.log('multiplayer:endGame:error', err); //TODO: handle error
                        }
                    });

                    gameProfHelper.addSmashes({
                        uid: gameData.users[1],
                        smashes: arrUniqCountGroup(gameData[gameData.users[1]])
                    }, function(err) {
                        if (err) {
                            console.log('multiplayer:endGame:error', err); //TODO: handle error
                        }
                    });*!/

                    delete socket.gId;

                } else {
                    curUser = gameData.users[(gameData.users.indexOf(gameData.currentUser) + 1 ) % 2];
                    updateObject.currentUser = JSON.stringify(curUser);
                    updateObject.stack = JSON.stringify(gameData.stack);
                    updateObject[socket.uId] = JSON.stringify( gameData[socket.uId] );
                    client.hmset(gameKey, updateObject, function(err, data) {
                        if (err) {
                            return console.log(err);
                        }

                        var currentStack = _.shuffle(_.map( gameData.stack, function( value ) {
                            return {
                                id: value,
                                x: ( smashOffset( SMASH_STACK_MAX_OFFSET )).toFixed(5),
                                y: ( smashOffset( SMASH_STACK_MAX_OFFSET )).toFixed(5)
                            }

                        } ));

                        io.to( gameId ).emit(
                            'turnEnd',
                            {
                                id:             gameData.id,
                                stack:          currentStack,
                                users:          gameData.users,
                                currentUser:    curUser,
                                ttl:            gameData.ttl
                            }
                        );
                    });

                }

            })*/
        });

        socket.on('disconnect', function() {
            var uId = socket.uId;
            var socketId = socket.id;
            var gameId = socket.gId;

            async.parallel(
                {
                    /*stop Search*/
                    searchStop: function (pCb) {
                        if (socket.inSearch) {
                            return stopSearch(uId, pCb);
                        }
                        pCb();
                    },

                    gameEnd: function (pCb) {
                        var gameId = socket.gId;

                        if (gameId) {
                            getGame(gameId, function (err, gameData) {
                                if (err) {
                                    return pCb(err);
                                }

                                if (!gameData) {
                                    return pCb();
                                }

                                gameData.leaver = uId;

                                endGame(gameData, pCb);
                            })
                        }
                    }
                },
                function (err, results) {
                    if (err) {
                        return console.log('ERROR:disconnect:'+socket.id+': ', err);
                    }

                    console.log('Socket:Disconnect:', socketId, ':',uId);
                }
            );

        });

    });
};

