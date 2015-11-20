var express = require('express');
var router = express.Router();
var GameHandler = require('../handlers/gameProfile');
var Session = require('../handlers/sessions');

module.exports = function (PostGre, app) {
    var session = new Session(PostGre);
    var gameHandler = new GameHandler(PostGre, app);

    router.post('/sync', gameHandler.syncOfflineGame);
    router.post('/game', session.isAuthorized, gameHandler.singleGame);
    router.post('/smash', session.isAuthorized, gameHandler.buySmashes);
    router.post('/flip', session.isAuthorized, gameHandler.addFlips);
    router.post('/achievement', session.isAuthorized, gameHandler.addAchievement);
    router.post('/invites', session.isAuthorized, gameHandler.setInvetes);

    router.get('/collection', session.isAuthorized, gameHandler.getMyCollection);
    router.get('/achievement', session.isAuthorized, gameHandler.getAchievementList);
    router.get('/booster/:id', session.isAuthorized, gameHandler.activateBooster);
    router.get('/opponent/:id', session.isAuthorized, gameHandler.getOpponent);
    router.get('/invites', session.isAuthorized, gameHandler.getInvites);
    router.get('/:id', session.isAuthorized, gameHandler.getProfileById);

    router.put('/:id', session.isAuthorized, gameHandler.updateProfile);

    return router;
};
