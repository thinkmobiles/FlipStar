
module.exports = function () {
    "use strict";

    var express = require('express');
    var path = require('path');
    var morgan = require('morgan');
    var cookieParser = require('cookie-parser');
    var bodyParser = require('body-parser');
    var app = express();
    var http = require('http');
    var session = require('express-session');
    var RedisStore = require('connect-redis')(session);
    var logger = require('./helpers/logger');
    var kafka = require('kafka-node');
    /*var clientOptions = process.env.KAFKA_HOST + ':' + process.env.KAFKA_PORT;*/
    /*var client = new kafka.Client(clientOptions);*/
    /*var producer = new kafka.HighLevelProducer(client);*/
    var eventQueueHandler = require('./helpers/eventQueue/kafkaServer');
    var eventQueue;
    var producer;

    var config;
    var knex;
    var PostGre;
    var Models;
    var sessionStore;
    var uploaderConfig;
    var imagesUploader;


    app.use( morgan('dev'));
    app.use(bodyParser.json({strict: false, inflate: false, limit: 1024 * 1024 * 200}));
    app.use(bodyParser.urlencoded({extended: false}));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));

    config = {
        db: parseInt(process.env.SESSION_DB) || 3,
        host: process.env.SESSION_HOST,
        port: parseInt(process.env.SESSION_PORT) || 6379
    };

    sessionStore = session({
        name: 'FlipStar',
        secret: 'd52642fee054a026141fbd843169b9bb',
        resave: true,
        saveUninitialized: true,
        cookie: {
            maxAge: 1000 * 60 * 60
        },
        store: new RedisStore(config)
    });
    app.set('sessionStore', sessionStore);
    app.use(sessionStore);

    knex = require('knex')({
        debug: true,
        client: 'pg',
        connection: {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME
            //charset: 'utf8'
        }
    });

    PostGre = require('bookshelf')(knex);

    Models = require('./models/index');

    uploaderConfig = {
        type: process.env.UPLOADING_TYPE,
        directory: 'public'//,
        /* awsConfig: {
         accessKeyId: process.env.AMAZON_ACCESS_KEY_ID,
         secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY,
         imageUrlDurationSec: 60 * 60 * 24 * 365 * 10
         }*/
    };
    imagesUploader = require('./helpers/imageUploader/imageUploader')(uploaderConfig);

    PostGre.imagesUploader = imagesUploader;

    PostGre.Models = new Models(PostGre);
    app.set('PostGre', PostGre);

    /* TODO remove in production */
    if (process.env.NODE_ENV === 'development') {
        console.log('Test Route');
        app.post('/authorize', function (req, res, next) {
            var uId = req.body.uId;
            req.session.uId = uId;
            res.status(200).send({message: 'authorized', uId: uId});
            console.log('Body:', req.body, req.query, req.body.uId);
            console.log('request:', req.headers);
            console.log('response:', res.headers);
        });

        app.get('/authorize', function (req, res, next) {
            var uId = req.query.uId;
            req.session.uId = uId;
            res.status(200).send({message: 'authorized', uId: uId});
            console.log('request:', req.headers);
            console.log('response:', res.headers);
        });

        app.get('/data', function (req, res, next) {
            res.status(200).json({key0: 'data0', key1: ['arrData0', 'arrData1']});
        });

        app.get('/sesStat', function (req, res, next) {
            if (req.session.uId) {
                console.log('request:', req.headers);
                res.status(200).send({message: 'authorized', uId: req.session.uId});
                console.log('response:', res.headers);
                return;
            }
            console.log('request:', req.headers);
            console.log('response:', res.headers);
            res.status(403).send({message: 'unAuthorized'});

        });

        app.post('/sesStat', function (req, res, next) {
            console.log(req.headers);
            if (req.session.uId) {
                return res.status(200).send({message: 'authorized', uId: req.session.uId, body: req.body});
            }
            res.status(403).send({message: 'unAuthorized', body: req.body});
        });

        app.get('/unAuthorize', function (req, res, next) {
            req.session.destroy();
            res.status(200).send({message: 'unAuthorized'});
        });

        /*app.get('/testKnex', function( req, res, next ) {
         /!* remove *!/
         if ( process.env.NODE_ENV === 'development') {
         knex('users_profile up').
         update({facebook_id:'fbUser10'}).
         where('up.id', )/!*.
         join(
         'game_profile as gp',
         function() {
         this.on('gp.user_id', 'up.id').
         andOn('gp.id', knex.raw('?', ['3']))
         }
         )*!/.then( function(result) {
         res.status(200).send(result);
         })
         }
         })*/
    }

    eventQueue = eventQueueHandler(app);
    producer = eventQueue.initProducer();

    /*producer.on('ready', function(){*/

        app.set('eventQueue', eventQueue);
        require('./routes/index')(app, PostGre);

    /*});*/

    /*producer.on('error', function(err){
        console.log(err);
    });*/

    return app;
};
