module.exports = (function () {
    var gcm = require( 'node-gcm' );

    var gcmClass = function ( googleApiKey ) {

        var sender = new gcm.Sender( googleApiKey );
        var message = new gcm.Message();

        function sendPush( registartionIds, msg, options) {
            var sendingMessageObject = {};
            var rabbit = app.get( 'rabbit' );

            sendingMessageObject.text = msg;

            if (options){

                if( options.payload && typeof options.payload === 'object' && Object.keys( options.payload ).length ) {
                    sendingMessageObject.payload = options.payload;
                }

                if( options.badge ) {
                    sendingMessageObject.badge = options.badge;
                }

                if( options.sound ) {
                    sendingMessageObject.sound = options.sound;
                }

                if( options.expirationDate ) {
                    var now = Math.floor( Date.now() / 1000 );
                    var timeToLive = options.expirationDate - now;
                    if( timeToLive > 0 ) {
                        message.timeToLive = timeToLive;
                    }
                }

            }

            message.addDataWithObject( sendingMessageObject );

            sender.send( message, registartionIds, 4, function ( err, result ) {
                console.log( '*********************Result GOOGLE**************************' );
                console.dir( result );
                console.log( '*********************-AFTER RESULT-***************************' );
            } );
        }

        sender.sendPush = sendPush;
        return sender;
    };

    return gcmClass;

})();