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
        /*for (var i = 0; i < 100; i += 1){
            setTimeout(function() {
                eventQueue.sendMessage(topic, msgObj, function (err, data) {
                    if (err) {
                        return next(err);
                    }
                });
            }, 200);
            
        }*/
        /*var counter = 0;

        var c = setInterval(function(){
            if (counter < countMsg){
                eventQueue.sendMessage(topic, msgObj, function (err, data) {
                    if (err) {
                        return next(err);
                    }
                    counter += 1;
                }); 

            } else {
                clearInterval(c);
            }
           
        }, 20)*/

        eventQueue.sendMessage(topic, msgObj, function (err, data){
            if (err){
                return next(err);
            }
            
            res.status(200).send({success: 'Message sent successfully'});

        })
        
        

    }
};
