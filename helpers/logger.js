/**
 * Created by eriy on 02.07.15.
 */
var winston = require('winston');
var path = require('path');
var appDir = path.dirname( require.main.filename );
var mainLogger;

mainLogger = new ( winston.Logger )({
    transports: [
        new (winston.transports.Console)({
            timestamp: true/*,
            colorize: true*/
        }),
        new (winston.transports.File)({
            filename: path.join( appDir, 'app.log' )
        })
    ]
});

module.exports = mainLogger;