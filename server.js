var http = require('http');
var app = require( './app' )();
var httpServer = http.createServer(app);
var io = require('./handlers/socket')( httpServer, app );
app.set('io', io );


// Create https for test facebook app notification
var https = require('https');
var fs = require('fs');
var privateKey  = fs.readFileSync('config/server.key', 'utf8');
var certificate = fs.readFileSync('config/server.crt', 'utf8');

var credentials = {key: privateKey, cert: certificate};
var httpsServer = https.createServer(credentials, app);


//var server = httpsServer.listen(process.env.PORT, function () {
//    console.log('=================================================================================');
//    console.log( "Express server listening on port " + server.address().port, 'enviroment: ', process.env.NODE_ENV );
//    console.log('=================================================================================');
//} );

var server = httpServer.listen(process.env.PORT, function () {
    console.log('=================================================================================');
    console.log( "Express server listening on port " + server.address().port, 'enviroment: ', process.env.NODE_ENV );
    console.log('=================================================================================');
} );



