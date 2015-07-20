module.exports = function() {
    var RESPONSES = require('../constants/responseMessages');

    this.isAuthorized = function( req, res, next ) {
        var err;

        if ( ! req.session.uId ) {
            err = new Error('UnAuthorized');
            return next( err );
        }

        next();
    };

    this.register = function (req, res, options) {
        req.session.loggedIn = true;
        req.session.uId = options.id;

        res.status(200).send({
            success: RESPONSES.LOGIN,
            uId: options.id
        });
    };

    this.kill = function (req, res, next) {
        if (req.session) {
            req.session.destroy();
        }
        res.status(200).send({success: RESPONSES.LOGOUT});
    };

};