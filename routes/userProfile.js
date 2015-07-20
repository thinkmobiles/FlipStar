var express = require('express');
var router = express.Router();
var UsersHandler = require('../handlers/usersProfile');
var Session = require('../handlers/sessions');

module.exports = function (PostGre, app) {
    var session = new Session(PostGre);
    var usersHandler = new UsersHandler(PostGre, app);

    router.post('/signUp', usersHandler.signUp);
    router.post('/signIn', usersHandler.signIn);

    return router;
};