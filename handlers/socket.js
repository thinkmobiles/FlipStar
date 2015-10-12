
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

    if (! err.sourceEvent) {
        err.sourceEvent = 'Server'
    }

    if (!err.message) {
        err.message = 'Something went wrong, please try again later'
    }

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

/*function arrUniqCountGroup(arr) {
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
}*/

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
            var queueKey = getKey({keyType: 'queue', keyData: bet});

            client.lpop( queueKey, function( err, queueData ) {
                var statusKey;

                if ( err ) {
                    return dCb(err);
                }

                if ( queueData && queueData !== uId ) {

                    statusKey = getKey({keyType: 'status', keyData: queueData});
                    client.hgetall( statusKey, function( err, searchData ) {
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

                            if (response.status === 'search') {
                                isFind = true;
                            } else {
                                response = null;
                            }

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
        timeOutDate: Date.now() + 1000 * TURN_TTL,
        ttl: TURN_TTL
    };

    for (var i = gameData.users.length; i--;) {
        gameData[gameData.users[i]] = []; //TODO posible uid confilct with object keys
    }

    var insObj = {};

    _.forEach(gameData, function(val, key) {
        insObj[key] = JSON.stringify(val);
    });

    var gameKey = getKey({keyType: 'game', keyData: gameData.id});

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

function getHashData(key, callback) {
    "use strict";
    client.hgetall(
        key,
        function(err, result) {
            var parsedData = {};

            if (err) {
                return callback(err);
            }

            if (!result) {
                return callback()
            }

            try {
                _.forEach(result, function (val, key) {
                    parsedData[key] = JSON.parse(val);
                });
            } catch (err) {
                return callback(err);
            }

            callback(null, parsedData);
        }
    );
}

function setHashData(key, data, callback) {
    "use strict";
    var setObject = {};
    var i;

    _.forEach(data, function(val, key) {
        setObject[key] = JSON.stringify(val);
    });

    client.hmset(key, setObject, callback);

};

function getRevenge(oldGameId, callback) {
    "use strict";
    var revengeKey = getKey({keyType: 'revenge', keyData: oldGameId});

    client.hgetall( revengeKey, function( err, gData) {
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

    client.del(getKey({keyType: 'status', keyData: userId}), function(err) {
        "use strict";
        if (err) {
            return callback(err);
        }

        callback();
    });

}

function setStatusIfNotExist(options, callback) {
    "use strict";
    /*
    * {
    *   uId:    string,
    *   status: string
    *   ttl:    integer
    * }
    * */
    var userId      = options.uId;
    var status      = options.status;
    var timeToLive  = options.ttl;
    var statusKey   = ':status:'+ userId + ':';
    var endTime     = Date.now + 1000 * timeToLive;
    var statusValue = JSON.stringify(':'+ status +':'+ endTime +':');

    client.hsetnx(statusKey, 'status', status, function(err, success) {
        if ( err ) {
            return callback(err);
        }

        if (!success) {
            /*client.hgetall(statusKey, function(err, data) {

             if (err) {
             return callback(err);
             }

             /!*try {
             data = JSON.parse(data);

             } catch(err) {
             return callback(err);

             }

             data  = data.split(':')[2];*!/

             callback(null, {
             isNew:          false,
             status:         data[1],
             statusDateEnd:  parseInt(data[2])
             })

             } )*/

            client.hgetall(statusKey, function (err, sData) {
                var statusData = {};

                if (err) {
                    return callback(err);
                }

                if (!sData) {
                    return callback()
                }

                try {
                    _.forEach(sData, function (val, key) {
                        statusData[key] = JSON.parse(val);
                    });
                } catch (err) {
                    return callback(err);
                }

                callback(null, statusData);
            });

            callback(null, {
                isNew: true,
                status: status,
                statusDateEnd: endTime
            });
        }
    });
}

function delStatus(userId, callback) {
    "use strict";
    var statusKey   = ':status:'+ userId + ':';

    client.del(statusKey, callback);

}

function getKey(data) {
    "use strict";
    var keyData = data.keyData;
    var keyType = data.keyType;
    var key;

    switch(keyType) {
        case 'search': {
            key = ':search:'+ keyData + ':';
        } break;

        case 'game': {
            key = ':game:' + keyData + ':';
        } break;

        case 'status': {
            key = ':status:'+ keyData + ':';
        } break;

        case 'queue': {
            key = ':queue:'+ keyData +':';
        } break;

        case 'revenge': {
            key = ':revenge:'+ keyData +':';
        } break;

        default: {
            key = null;
        } break;
    }

    return key;
}

function cleanGameData(data, callback) {
    "use strict";
    var gameId          = data.gameId;
    var users           = data.users;

    client.del(
        /*getKey({
            keyType:    'search',
            keyData:    users[0]
        }),

        getKey({
            keyType:    'search',
            keyData:    users[1]
        }),*/

        getKey({
            keyType:    'game',
            keyData:    gameId
        }),

        getKey({
            keyType:    'status',
            keyData:    users[0]
        }),

        getKey({
            keyType:    'status',
            keyData:    users[1]
        }),

        function(err) {
            if (err) {
                return callback(err);
            }

            callback();
        }
    );

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
        var gameId  = gameData.id;
        var leaver  = gameData.leaver;
        var gameKey = getKey({keyType: 'game', keyData: gameId});
        var users   = gameData.users;
        var endResponse;

        if (leaver) {
            gameData[leaver] = gameData[leaver].concat(gameData.stack);
        }

        async.parallel(
            {
                delGameRecord: function (pCb) {
                    cleanGameData(
                        {
                            gameId: gameId,
                            users:  users
                        },
                        pCb
                    )
                },

                addWinStacks: function (pCb) {
                    endResponse = {
                        id:    gameId,
                        user1: gameData[gameData.users[0]],
                        user2: gameData[gameData.users[1]],
                        users: gameData.users,
                        /*timeToRevenge*/ttl: TIME_TO_REVENGE
                    };

                    async.each(
                        endResponse.users,
                        function(user, eCb) {
                            gameProfHelper.addSmashes({
                                uid: user,
                                smashes: endResponse['user' + (endResponse.users.indexOf(user) + 1) ]
                            }, function(err) {
                                if (err) {
                                    return eCb(err);
                                }

                                debug('addWinStacks: ' + gameKey + ' :' + user + ' - ' + endResponse['user' + (endResponse.users.indexOf(user) + 1)] );
                                eCb();
                            });
                        },
                        function(err) {
                            if (err) {
                                return pCb(err);
                            }

                            debug('addWinStacks: ' + gameKey + ' :Success');
                            pCb();
                        }
                    )
                },

                createRevengeRecord: function (pCb) {
                    var revengeKey      = getKey({keyType: 'revenge', keyData: gameId});
                    var revengeObject   = {
                        users:          JSON.stringify(users),
                        bet:            JSON.stringify(gameData.bet),
                        timeOutDate:    JSON.stringify(Date.now() + TIME_TO_REVENGE * 1000)
                    };

                    client.hmset(
                        revengeKey,
                        revengeObject,
                        function(err) {
                            if (err) {
                                return pCb(err);
                            }

                            client.expire(revengeKey, TIME_TO_REVENGE, pCb)
                        }
                    );

                }

            },
            function(err) {
                if (err) {
                    return callback(err);
                }

                /*io.to( gameId ).emit(
                    'endGame',
                    endResponse
                );*/

                callback(null, endResponse);
            }
        );
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
            /* TODO: add validation */
            var uId = socket.uId;
            var bet = parseInt( data.bet ) | 0;
            var stack = data.stack;
            var socketId = socket.id;
            var now = Date.now();

            async.waterfall(
                [
                    /*function(wCb) {
                        if (socket.status) {
                            return wCb(err);
                        }

                        wCb();
                    },*/

                    /* Get User Status */
                    function(wCb) {
                        var statusKey = getKey({keyType: 'status', keyData: uId});

                        getHashData(
                            statusKey,
                            function(err, statusData) {
                                var now = Date.now();

                                if (err) {
                                    return wCb(err);
                                }

                                /* TODO: uncoment below if statuses ready*/
                                /*if ( statusData && now < statusData.dateToLive ) {
                                    err = new Error('user is busy');
                                    return wCb(err);
                                }*/

                                wCb();
                            }
                        )
                    },

                    /* Get Opponent */
                    function(wCb) {
                        getOpponent( uId, bet, function ( err, opponentData ) {

                            if (err) {
                                return wCb(err);
                            }

                            if (!opponentData) {
                                return wCb(null, {status: 'queue'});
                            }

                            wCb(null, {status: 'game', opponent: opponentData});
                        });
                    },

                    /*add to queue*/
                    function(data, wCb) {
                        var queueKey;

                        /*if (!data || !(data.status === 'queue')) {
                            return wCb()
                        }*/

                        if (data && data.status === 'queue') {

                            async.waterfall(
                                [
                                    /*add search record*/
                                    function(wCb2) {
                                        var statusKey = getKey({keyType: 'status', keyData: uId});

                                        client.hmset(
                                            statusKey,
                                            {
                                                socketId:   JSON.stringify(socket.id),
                                                bet:        JSON.stringify(bet),
                                                stack:      JSON.stringify(stack),
                                                uId:        JSON.stringify(uId),
                                                status:     JSON.stringify('search'),
                                                dateToLive: JSON.stringify( Date.now() + SEARCH_TTL * 1000 )
                                            },

                                            function(err) {
                                                if (err) {
                                                    return wCb2(err);
                                                }

                                                wCb2();

                                            }
                                        );


                                    },

                                    /*add user to search queue*/
                                    function(wCb2) {
                                        var queueKey = getKey({keyType: 'queue', keyData: bet});
                                        client.rpush(
                                            queueKey,
                                            uId,
                                            function(err, rpushResult) {
                                                if (err) {
                                                    return wCb2(err);
                                                }

                                                wCb2()
                                            }
                                        );
                                    }
                                ],

                                function(err) {
                                    if (err) {
                                        return wCb(err)
                                    }
                                    socket.status = 'search';
                                    socket.emit('addToQueue', { ttl: SEARCH_TTL });
                                }
                            );

                        } else {
                            wCb(null, data);
                        }

                    },

                    /*create Game*/
                    function(data, wCb) {
                        var opponent = data.opponent;

                        if (data && data.status === 'game') {

                            /* TODO: need transaction or validation. */
                            async.parallel(
                                {
                                    user1: function (pCb) {
                                        gameProfHelper.removeSmashes({
                                            uid: uId,
                                            smashes: stack
                                        },function (err) {
                                            if (err) {
                                                return pCb(err);
                                            }
                                            debug('removeSmash:uId - ', uId, ':smashes - ', stack);
                                            pCb();
                                        });
                                    },

                                    user2: function (pCb) {
                                        gameProfHelper.removeSmashes({
                                            uid: opponent.uId,
                                            smashes: opponent.stack
                                        },function (err) {
                                            if (err) {
                                                return pCb(err);
                                            }
                                            debug('removeSmash:uId - ', opponent.uId, ':smashes - ', opponent.stack);
                                            pCb();
                                        });
                                    }
                                },

                                function(err) {
                                    if (err) {
                                        return wCb(err);
                                    }

                                    createGame(
                                        { bet: bet, uId: uId, stack: stack },
                                        { bet: opponent.bet, uId: opponent.uId, stack: opponent.stack },
                                        function( err, gameData ) {
                                            var result;

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

                                            socket.status   = 'game';

                                            wCb();
                                        }
                                    )
                                }
                            );

                        } else {
                            wCb()
                        }

                    }

                ],

                /*startSearch MAIN CALLBACK*/
                function(err, result) {
                    if (err) {
                        return console.log(err);
                    }

                    console.log('StartSearch: Success');
                }
            );

        });

        socket.on('stopSearch', function( data ) {
            var uId         = socket.uId;
            var socketId    = socket.id;
            var stopOptions = {
                uId:        uId,
                socketId:   socketId
            };

            stopSearch(uId, function(err){
                if (err) {
                    return console.log('ERROR:stopSearch: ', err);
                }
                socket.status = null;
                socket.emit('endSearch', {message: 'Success'});

            });

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
            socket.status = 'game';
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
                                err = new Error('Game does not exist');
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
                                function(err, response) {
                                    if (err) {
                                        return wCb(err);
                                    }

                                    io.to( gameId ).emit(
                                        'endGame',
                                        response
                                    );

                                    delete socket.gId;
                                    wCb();
                                }
                            );

                        } else {
                            curUser = gameData.users[(gameData.users.indexOf(gameData.currentUser) + 1 ) % 2];
                            updateObject.currentUser = JSON.stringify(curUser);
                            updateObject.stack = JSON.stringify(gameData.stack);
                            updateObject[socket.uId] = JSON.stringify( gameData[socket.uId] );
                            updateObject.timeOutDate = JSON.stringify(Date.now() + 1000 * TURN_TTL);

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
        });

        socket.on('timeOutTurn', function(data) {
            var gameId  = socket.gId;
            var uId     = socket.uId;


            async.waterfall(
                [
                    /* Get Game Data*/
                    function(wCb) {
                        getGame(gameId, function(err, gData) {
                            if (err) {
                                return wCb(err);
                            }

                            if (!gData) {
                                err = new Error('Game does not exist');
                                err.status = 404;
                                return wCb(err);
                            }

                            wCb(null, gData);
                        })
                    },

                    /*Handle game data*/
                    function(gData, wCb) {
                        var now     = Date.now();
                        var leaver  = gData.users[(gData.users.indexOf(uId) +1) % 2];
                        var currentStack;

                        if (gData.timeOutDate < now && gData.currentUser === leaver) {

                            gData.leaver = leaver;

                            return endGame(gData, function(err, response) {
                                if (err) {
                                    return wCb(err);
                                }

                                io.to( gameId ).emit(
                                    'endGame',
                                    response
                                );

                                delete socket.gId;

                                wCb();
                            });
                        }

                        if ( gData.currentUser === uId ) {

                            /* TODO: save stack with offset in redis and here return from redis*/
                            currentStack = _.shuffle(_.map( gData.stack, function( value ) {
                                return {
                                    id: value,
                                    x: ( smashOffset( SMASH_STACK_MAX_OFFSET )).toFixed(5),
                                    y: ( smashOffset( SMASH_STACK_MAX_OFFSET )).toFixed(5)
                                }

                            } ));

                            socket.emit(
                                'turnEnd',
                                {
                                    id:             gData.id,
                                    stack:          currentStack,
                                    users:          gData.users,
                                    currentUser:    gData.currentUser,
                                    ttl:            ((gData.timeOutDate - now) / 1000) |0 //TODO: test
                                }
                            );

                            return wCb();
                        }

                        wCb();
                    }
                ],
                function(err) {
                    if (err) {
                        err.sourceEvent = 'timeOutTurn';
                        return eventError(err, socket);
                    }
                }
            );


        });

        socket.on('disconnect', function() {
            var uId = socket.uId;
            var socketId = socket.id;
            var gameId = socket.gId;

            async.parallel(
                {
                    /*stop Search*/
                    searchStop: function (pCb) {
                        if (socket.status && socket.status === 'search' ) {
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

                                endGame(gameData, function(err, response) {
                                    if (err) {
                                        return pCb(err);
                                    }

                                    io.to( gameId ).emit(
                                        'endGame',
                                        response
                                    );

                                    delete socket.gId;

                                    pCb();
                                });
                            });
                        } else {
                            pCb();
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

        socket.on('startRevenge', function(data) {
            var uId     = socket.uId;
            var bet     = data.bet;
            var oldGameId = data.gId;
            var stack   = data.stack;
            var revengeKey  = getKey({keyType: 'revenge', keyData: oldGameId});

            async.waterfall(
                [
                    function(wCb) {
                        getHashData(revengeKey, wCb);
                    },

                    function( revengeData, wCb ) {
                        var err;
                        var updateObject = {};
                        var now = Date.now();

                        if ( revengeData.users.indexOf(uId) < 0 ) {
                            err = new Error('Bad game data');
                            return wCb(err);
                        }

                        if ( !revengeData ) {
                            err = new Error('No revenge data');
                            return wCb(err);
                        }

                        if ( !revengeData.aprovedUsers ) {
                            updateObject.aprovedUsers   = [uId];
                            updateObject[uId]           = stack;

                            return setHashData(revengeKey, updateObject, function(err) {
                                if (err) {
                                    return wCb(err);
                                }
                                var opponent = revengeData.users[(revengeData.users.indexOf(uId) + 1) % 2];
                                io.to(opponent).emit(
                                    'revenge',
                                    {
                                        bet:        revengeData.bet,
                                        id:         oldGameId,
                                        ttl:        ((revengeData.timeOutDate - now) /1000 )|0
                                    }
                                );

                                socket.emit(
                                    'queueRevenge',
                                    {
                                        ttl: ((revengeData.timeOutDate - now) /1000 )|0
                                    }
                                );

                                wCb()
                            });

                            /*return client.hmset(revengeKey, updateObject, function(err) {
                                if (err) {
                                    return wCb(err);
                                }
                                var opponent = revengeData.users[(revengeData.users.indexOf(uId) + 1) % 2];
                                io.to(opponent).emit(
                                    'revenge',
                                    {
                                        bet:        revengeData.bet,
                                        id:         oldGameId,
                                        ttl:        ((revengeData.timeOutDate - now) /1000 )|0
                                    }
                                );

                                socket.emit(
                                    'queueRevenge',
                                    {
                                        ttl: ((revengeData.timeOutDate - now) /1000 )|0
                                    }
                                );

                                wCb()
                            })*/
                        }

                        if ( revengeData.aprovedUsers && revengeData.aprovedUsers.length) {

                            return createGame(
                                { bet: bet, uId: uId, stack: stack },
                                { bet: bet, uId: revengeData.aprovedUsers[0], stack: revengeData[revengeData.aprovedUsers[0]] },
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
                        }


                    }
                ],

                function(err) {
                    if (err) {
                        err.sourceEvent ='startRevenge';
                        eventError(err, socket);
                    }
                }
            )

        });

        socket.on('refuseRevenge', function(data) {
            var oldGameId = data.id;
            var revengeKey  = getKey({keyType: 'revenge', keyData: oldGameId});

            getHashData(revengeKey, function(err, revengeData) {
                if (err) {
                    err.sourceEvent ='refuseRevenge';
                    return eventError(err);
                }

                client.del(
                    getKey({keyType: 'revenge', keyData: oldGameId}),
                    function (err) {
                        if(err) {
                            return console.log(err);
                        }

                        socket.to(revengeData.aprovedUsers[0]).emit(
                            'refuseRevenge',
                            {
                                id: oldGameId
                            }
                        );
                    }
                );

            });

        })

    });
};

