var express = require('express');
var router = express.Router();
var UsersHandler = require('../handlers/usersProfile');
var Session = require('../handlers/sessions');

module.exports = function (PostGre, app) {
    var session = new Session(PostGre);
    var usersHandler = new UsersHandler(PostGre, app);

    router.post('/signUp', usersHandler.signUp);
    router.post('/signIn', usersHandler.signIn);
    router.post('/signUpFB', usersHandler.signUpViaFB);

    router.get('/signOut', usersHandler.signOut);
    router.get('/:id', usersHandler.getProfileById);

    router.put('/:id', usersHandler.updateProfile);

    return router;
};