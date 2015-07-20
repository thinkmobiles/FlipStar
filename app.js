
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

//var marked = require('marked');

    var markdownString = '```js\n console.log("hello"); \n```';

    var port;
    var server;
    var config;
    var knex;
    var PostGre;
    var Models;
    var sessionStore;

//app.engine('html', cons.swig);
//app.set('view engine', 'html');
//app.set('views', __dirname + '/views');


    app.use( morgan('dev'));
    app.use(bodyParser.json({strict: false, inflate: false, limit: 1024 * 1024 * 200}));
    app.use(bodyParser.urlencoded({extended: false}));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));


//app.set('views', __dirname + '/public/templates/static');
//app.set('view engine', 'html');

    /*if (process.env.NODE_ENV) {
        require('./config/' + process.env.NODE_ENV.toLowerCase());
    } else {
        process.env.NODE_ENV = 'production';
        require('./config/production');
    }*/

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
            maxAge: 1000 * 60 * 10
        },
        store: new RedisStore(config)
    });
    app.set( 'sessionStore', sessionStore );
    app.use( sessionStore );

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
     //Collections = require('./collections/index');

    /*var uploaderConfig = {
     type: process.env.UPLOADING_TYPE,
     directory: 'public'//,
     /!* awsConfig: {
     accessKeyId: process.env.AMAZON_ACCESS_KEY_ID,
     secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY,
     imageUrlDurationSec: 60 * 60 * 24 * 365 * 10
     }*!/
     };*/
    /*var imagesUploader = require('./helpers/imageUploader/imageUploader')(uploaderConfig);

     PostGre.imagesUploader = imagesUploader;*/

    PostGre.Models = new Models(PostGre);
    //PostGre.Collections = new Collections(PostGre);
    app.set('PostGre', PostGre);

    require('./routes/index')(app, PostGre);

    /*port = parseInt(process.env.PORT) || 8835;*/
    /*server = http.createServer(app);*/

    /*server.listen(port, function () {
        console.log('Express start on port ' + port);
    });*/

    return app;
};
