module.exports = function(PostGre) {
    var RESPONSES = require('../constants/responseMessages');
    var TABLES = require('../constants/tables');

    this.isAuthorized = function( req, res, next ) {
        var err;

        if (!req.session.loggedIn) {
            err = new Error(RESPONSES.UNATHORIZED);
            err.status = 400;
            return next(err);
        }

        next();
    };

    this.checkPermissions = function (req, res, next) {
        var options = req.body;
        var uid = req.session.uId;
        var checkId = options.uId || req.params.id;
        var err;

        PostGre.knex(TABLES.GAME_PROFILE)
            .select('id')
            .where('id', checkId)
            .then(function (queryResult) {
                err = new Error(RESPONSES.FORBIDDEN);
                err.status = 403;

                queryResult[0].id === uid ? next() : next (err)
            })
            .catch(next)
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