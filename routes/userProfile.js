var express = require('express');
var router = express.Router();
var UsersHandler = require('../handlers/usersProfile');
var Session = require('../handlers/sessions');

module.exports = function (PostGre, app) {
    var session = new Session(PostGre);
    var usersHandler = new UsersHandler(PostGre, app);

    router.post('/signIn', usersHandler.signIn);
    router.post('/addFriends', usersHandler.addFBFriends);


    router.get('/signOut', usersHandler.signOut);
    router.get('/friends', usersHandler.getFriends);
    router.get('/topRank', usersHandler.getTopRankList);


    router.put('/:id', usersHandler.updateUserProfile);

    return router;
};