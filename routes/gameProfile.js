var express = require('express');
var router = express.Router();
var GameHandler = require('../handlers/gameProfile');
var Session = require('../handlers/sessions');

module.exports = function (PostGre, app) {
    var session = new Session(PostGre);
    var gameHandler = new GameHandler(PostGre, app);

        router.post('/sync', gameHandler.syncOfflineGame);
        router.post('/game', gameHandler.singleGame);
        router.post('/smash', gameHandler.openOrBuySmashes);

        router.get('/collection', gameHandler.getMyCollection);
        router.get('/booster/:id', gameHandler.activateBooster);
        router.get('/:id', gameHandler.getProfileById);

        router.put('/:id', gameHandler.updateProfile);
    return router;
};