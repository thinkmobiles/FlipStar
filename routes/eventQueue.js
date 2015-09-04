var express = require('express');
var router = express.Router();
var QueueHandler = require('../handlers/testQueue');

module.exports = function(PostGre, app){
    var queue = new QueueHandler(app);

    //TODO: TEST queue

    router.post('/', queue.publishMsg);

    return router;
};