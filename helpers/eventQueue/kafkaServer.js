/**
 * Created by eriy on 06.08.15.
 */


module.exports = function(app/*, producer*/){

    var PostGre = app.get('PostGre');
    var kafka = require('kafka-node');
    var _ = require('lodash');
    var Consumers = require('./consumers')(app, PostGre);
    var Consumer = kafka.HighLevelConsumer;
    var Producer = kafka.HighLevelProducer;

    var Broker = {
        consumers: {},
        producers: {}
    };

    var clientOptions = process.env.KAFKA_HOST + ':' + process.env.KAFKA_PORT;

    Broker.initProducer = function() {

        var producerClient = new kafka.Client(clientOptions);
        var producer = new Producer( producerClient );
        Broker.producers['main'] = producer;
        return producer;
    };

    Broker.sendMessage = function (topic, message, callback) {

        if (callback && typeof callback === 'function') {
            Broker.producers.main.send([{topic: topic, messages: JSON.stringify(message)}], callback);
        }

    };

    _.forEach(Consumers, function (value, key) {

        var clientC = new kafka.Client(clientOptions);
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

        consumer.on('error', function(err){
           console.error(err);
           consumer.close(true, function(){
                consumer.removeAllListeners();
                clientC = new kafka.Client(clientOptions);
                consumer.client = clientC;
                setTimeout(function() {
                        consumer.connect();
                }, Math.random() * 5000 | 0);
                
           });
        });

        Broker.consumers[key] = consumer;

    });

    return Broker;
};


