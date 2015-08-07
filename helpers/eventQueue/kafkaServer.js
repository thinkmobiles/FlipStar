/**
 * Created by eriy on 06.08.15.
 */
var kafka = require('kafka-node');
var _ = require('lodash');
var Consumers = require('./consumers');

var Producer = kafka.Producer;
var Consumer = kafka.Consumer;
var Client = kafka.Client;
var Broker = {
    consumers: {},
    producers: {}
};

var clientOptions = process.env.KAFKA_HOST + ':' + process.env.KAFKA_PORT;

var pClient = new Client();
var producer = new Producer( pClient );


producer.on('ready', function() {

    console.log( 'Producer is ready');

    Broker.producers['main'] = producer;

    Broker.sendMessage = function( topic, message, callback ) {

        Broker.producers.main.send( [ { topic: topic, messages: JSON.stringify( message ), partition: 0 } ], function( err, data ) {
            typeof callback === 'function' && callback( err, data );
        } );

    };

    _.forEach( Consumers, function( value, key ) {
        var client = new Client();

        producer.createTopics( [key] , function (err, data) {

            var consumer = new Consumer(
                client,
                [
                    {
                        topic: value.topic, partition: 0
                    }
                ],
                {}
            );

            consumer.on( 'message', function( message ) {
                try {
                    message.value = JSON.parse( message.value );
                } catch( err ) {

                    console.log('Bad formed JSON message: ', message.value );
                    message.value = '';
                }

                value.callback( message );

            });

            Broker.consumers[ key ] = consumer;

        });

    });

});


module.exports = Broker;