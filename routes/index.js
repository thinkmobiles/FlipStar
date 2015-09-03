module.exports = function (app, PostGre) {
    var Session = require('../handlers/sessions');

    //Constants
    var RESPONSES = require('../constants/responseMessages');

    //Routers
    var usersRouter = require('./userProfile')(PostGre, app);
    var gameRouter = require('./gameProfile')(PostGre, app);
    var purchaseRouter = require('./purchase')(PostGre, app);
    var queueRouter = require('./eventQueue')(PostGre, app);
    var session = new Session(PostGre);

    app.get('/test', function (req, res, next) {
        res.status(200).send('Test OK');
    });

    app.use('/user', usersRouter);
    app.use('/gameProfile', gameRouter);
    app.use('/purchase', purchaseRouter);
    app.use('/queue', queueRouter);

    function notFound(req, res, next) {
        res.status(404);

        if (req.accepts('html')) {
            return res.send(RESPONSES.PAGE_NOT_FOUND);
        }

        if (req.accepts('json')) {
            return res.json({error: RESPONSES.PAGE_NOT_FOUND});
        }

        res.type('txt');
        res.send(RESPONSES.PAGE_NOT_FOUND);
    }

    function errorHandler(err, req, res, next) {
        var status = err.status || 500;

        if (process.env.NODE_ENV === 'production') {
            if (status === 401) {
                logWriter.log('', err.message + '\n' + err.stack);
            }
            res.status(status);
        } else {
            if (status !== 401) {
                logWriter.log('', err.message + '\n' + err.stack);
            }
            res.status(status).send(err.message + '\n' + err.stack);
        }

        if (status === 401) {
            console.warn(err.message);
        } else {
            console.error(err.message);
            //console.error(err.stack);
        }

        /*// TODO change

        console.error(err.stack);
        res.status(status).send({error: err.message || err, stack: err.stack});*/
    }

    app.use(notFound);
    app.use(errorHandler);
};