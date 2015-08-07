/**
 * Created by eriy on 07.08.15.
 */

var pushConsumer = {

    topic: 'push',

    callback: function (message) {

        console.log( ' Consumer Event: ', message );

    }

};

var profileConsumer = {

    topic: 'profile',

    callback: function (message) {

        console.log(' Consumer Event: ', message );

    }

};

var gameConsumer = {

    topic: 'game',

    callback: function (message) {
        console.log( ' Consumer Event: ', message );
    }

};

module.exports = {

    push: pushConsumer,
    profile: profileConsumer,
    game: gameConsumer

};