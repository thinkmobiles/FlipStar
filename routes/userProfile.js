var express = require('express');
var router = express.Router();
var UsersHandler = require('../handlers/usersProfile');
var FBNotificationsHandler = require('../handlers/FBnotifications');
var Session = require('../handlers/sessions');

module.exports = function (PostGre, app) {
    var session = new Session(PostGre);
    var usersHandler = new UsersHandler(PostGre, app);
    var fbHandler = new FBNotificationsHandler(app);

    router.post('/signIn', usersHandler.checkEnterAchievement, usersHandler.signIn);
    router.post('/friends', usersHandler.addFBFriends);


    router.get('/signOut', usersHandler.signOut);
    router.get('/friends', usersHandler.getFriends);
    router.get('/topRank', usersHandler.getTopRankList);

    router.post('/fb/:id', fbHandler.requestFBNotification);
    router.get('/fb/group', fbHandler.getbygroup);


    router.put('/:id', usersHandler.updateUserProfile);

    return router;
};