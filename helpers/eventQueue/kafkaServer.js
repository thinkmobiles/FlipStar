/**
 * Created by eriy on 06.08.15.
 */


module.exports = function(app, producer){

    var PostGre = app.get('PostGre');
    var kafka = require('kafka-node');
    var _ = require('lodash');
    var Consumers = require('./consumers')(PostGre);

//    var Producer = kafka.HighLevelProducer;
    var Consumer = kafka.HighLevelConsumer;

    var Broker = {
        consumers: {},
        producers: {}
    };

    var clientOptions = process.env.KAFKA_HOST + ':' + process.env.KAFKA_PORT;
  //  var producer = new Producer( client );


    Broker.producers['main'] = producer;

    Broker.sendMessage = function (topic, message, callback) {

        if (callback && typeof callback === 'function') {
            Broker.producers.main.send([{topic: topic, messages: JSON.stringify(message)}], callback);
        }

    };

    _.forEach(Consumers, function (value, key) {
        var clientC = new kafka.Client('192.168.88.99:2181');
        var consumer = new Consumer(
            clientC,
            [
                {
                    topic: value.topic
                }
            ],
            {
            }
        );

        consumer.on('message', function (message) {
            try {
                message.value = JSON.parse(message.value);
            } catch (err) {

                console.log('Bad formed JSON message: ', message.value);
                message.value = '';
            }
            message['consumerId'] = consumer.id;

            value.callback(message);

        });

        /*consumer.on('error', function(err){
           console.error(err);
           consumer.close(true, function(){
                
           });
        });*/

        Broker.consumers[key] = consumer;

    });

    return Broker;
};


