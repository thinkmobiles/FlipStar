var http = require('http');
var app = require( './app' )();
var httpServer = http.createServer(app);
var io = require('./handlers/socket')( httpServer, app );
app.set('io', io );

var server = httpServer.listen(process.env.PORT, function () {
    console.log( "Express server listening on port " + server.address().port, 'enviroment: ', process.env.NODE_ENV );
} );

