var express = require('express');
var http = require('http');

//TODO change NODE_ENV for production server
process.env.NODE_ENV = 'development';

//development only
if (process.env.NODE_ENV === 'production') {
    console.log('-----Server start success in Production version--------');
    require('../config/production');
} else {
    console.log('-----Server start success in Development version--------');
    require('../config/development');
}

var Knex = require('knex');
var pg = require('pg');
var Promise = require('bluebird');
var crypto = require("crypto");
var CONSTANTS = require('../constants/constants');

Knex.knex = Knex.initialize({
    debug: true,
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME
    }
});

var knex = Knex.knex;
var schema = require('./schema')(knex, Promise);
var bookshelf = require('bookshelf')(knex);

var app = express();
var server = http.createServer(app);

app.configure(function () {
    app.set('port', 8081);
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(__dirname, '/public'));
    app.use(express.errorHandler());
});

app.configure('development', function () {
    app.use(express.errorHandler());
});

String.prototype.getBytes = function () {
    var bytes = [];
    for (var i = 0; i < this.length; ++i) {
        bytes.push(this.charCodeAt(i));
    }
    return bytes;
};

String.prototype.convertToBigCamelCase = function () {
    var splitArray = this.split('_');
    var newStr = '';

    splitArray.forEach(function(item){
        newStr += item[0].toUpperCase() + item.substring(1)
    });

    return newStr;
};

app.get('/', function (req, res) {
    var html = "";
    html += '<h2>Database Operations</h2><hr/>';

    html += '<a href="/databases/create">Create Tables</a><br/>';
    html += '<a href="/databases/drop">Drop Tables</a><br/>';
    html += '<a href="/databases/default">Set Defult Date</a><br/>';
    html += '<a href="/add_admin">Add admin</a><br/>';
    //html+='<a href="/seed/default">Seed Default</a><br/>';
    //html+='<a href="/seed/fake">Seed Fake</a><br/>';

    res.send(html);
});


app.get('/databases/create', function (req, res) {
    schema.create();
    res.send('<b>Create Take Success</b>');
});

app.get('/databases/drop', function (req, res) {
    schema.drop();
    res.send('<b>Drop Take Success</b>');
});

app.get('/databases/default', function (req, res) {
    schema.setDefaultData(req, res);
});

app.get('/add_admin', function (req, res) {
    var admin = bookshelf.Model.extend({
        tableName: 'users',
        hasTimestamps: true
    });
    var shaSum = crypto.createHash('sha256');

    shaSum.update("admin");
    var pass = shaSum.digest('hex');
    admin.forge({
            password: pass,
            email: "admin@admin.com",
            first_name: "Admin",
            last_name: "Admin",
            role: CONSTANTS.USERS_ROLES.ADMIN
        })
        .save()
        .then(function () {
            res.status(201).send('<b>Admin was created successful</b>');
        })
        .catch(function (error) {
            res.status(500).send(error);
    });

});


server.listen(3000, function () {
    console.log("Express server listening on port " + 3000);
});


