/**
 * Created by migal on 12.08.15.
 */
var QueueHandler = require('../helpers/eventQueue/kafkaServer');

module.exports = function(app){

    

   /* producer.on('ready', function () {*/
        eventQueue = app.get('eventQueue');
        //console.log('Kafka serv:', eventQueue);
        //app.set('eventQueue', eventQueue);
    /*});*/

    //var kafka = app.get('eventQueue');

    //console.log(kafka);

    this.publishMsg = function(req, res, next){

        var body = req.body;
        var topic = body.topic;

        var msgObj = {
            message: body.msg,
            userId: 1
        };


        //app.set('eventQueue', eventQueue);
        eventQueue.sendMessage(topic, msgObj, function (err, data) {
            if (err) {
                return next(err);
            }


            res.status(200).send({success: 'Message sent successfully'});
        });


    }
};
