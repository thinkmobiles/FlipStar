/**
 * Created by eriy on 23.07.15.
 */
var _ = require('lodash');
var async = require('async');
var store = require('../helpers/redisStore')();

var maxOffset = 0.2;

function smashOffset() {

    return Math.random() * maxOffset;

}

function createGameId( userIdArr ) {
    return ':'+ userIdArr.sort().join(':') + ':';
}

function getRandomUser( users ) {

    return users[ Math.floor( Math.random() * users.length ) ];

}

function nextUser( user, users ) {



}

function createOnlineGameRecord( params, callback ) {
    var users = params.users; // [ userId ]
    var stack = params.stack; // [ smashId ]

    var currentStack = _.shuffle(_.map( stack, function( value ) {
        return {
            smashId: value,
            x: smashOffset(),
            y: smashOffset()
        }

    } ));

    var game = {
        id: createGameId( users ),
        stack: stack,
        currentStack: currentStack,
        users: users,
        round: 1,
        currentUser: getRandomUser( users )
    };

    for (var i = users.length; i--; ) {
        game[users[i]] = [];
    }

    store.writeToStorage( gameId, game, function( err ) {
        if (err) {
            return callback( err );
        }

        callback( null, game );
    } );

}



function getUserGameList( userId, callback ) {
    store.findKeys( '*:' + userId + ':*', callback );
}

function endTurn( userId, gameId, winSmashes ) {
    store.readFromStorage( gameId, [ 'users', 'round' ] )
}

function endGame( gameId ) {

}

function getOnlineGameStatus( gameId, callback ) {
    store.readFromStorage( gameId, callback )
}

function searchOnlineGame( userId, bet, stack ) {

}

module.exports = function() {

    return {

        searchOnlineGame: searchOnlineGame,
        createOnlineGameRecord : createOnlineGameRecord,
        getOnlineGameStatus : getOnlineGameStatus,
        getUserGameList : getUserGameList

    }

};