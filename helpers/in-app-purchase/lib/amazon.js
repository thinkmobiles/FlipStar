var constants = require('../constants');
var request = require('request');
var async = require('async');

module.exports = function () {

    var config = null;
    var VER = '2.0';
    var secret;
    var email;
    var ERRORS = {
        validation: {
            400: 'The transaction represented by this Purchase Token is no longer valid.',
            496: 'Invalid sharedSecret',
            497: 'Invalid User ID',
            498: 'Invalid Purchase Token',
            499: 'The Purchase Token was created with credentials that have expired, use renew to generate a valid purchase token.',
            500: 'There was an Internal Server Error'
        },
        renew: {
            400: 'Bad Request',
            496: 'Invalid sharedSecret',
            497: 'Invalid User ID',
            498: 'Invalid Purchase Token',
            500: 'There is an Internal Server Error'
        }
    };


    //var RENEW_PATH = 'https://appstore-sdk.amazon.com/version/' + VER + '/renew/developer/' + SECRET + '/user/' + UID + '/purchaseToken/' + PTOKEN;

    function isValidConfigKey(key) {
        return key.match(/^amazon/);
    }

    function readConfig (configIn) {
        var configValueSet;

        if (!configIn) {
            return;
        }

        config = {};
        configValueSet = false;

        Object.keys(configIn).forEach(function (key) {
            if (isValidConfigKey(key)) {
                config[key] = configIn[key];
                configValueSet = true;
            }
        });

        if (!configValueSet) {
            config = null;
            return;
        }

    };

    function setup (callback) {
        var err;

        if (!config) {
            err = new Error('Invalid configurations');
            err.status = 400;
            return callback(err);
        }

        secret = config['key'];
        email = config['email'];

        callback(null);

    };

    function validatePurchase (receipt, callback) {
        var validationPath;
        var ver = '2.0';
        var uId = receipt.userId;
        var purchaseToken = receipt.purchaseToken;
        var purchase = _.cloneDeep(receipt);

        validationPath = 'https://appstore-sdk.amazon.com/version/' + ver + '/verify/developer/' + secret + '/user/' + uId + '/purchaseToken/' + purchaseToken;

        request({

            url: validationPath,
            json: true

        }, function (err, res, body) {

            if (err) {
                return callback(err);
            }

            if (res.statusCode === 400) {
                return callback(new Error(ERRORS.validation['400']));
            } else if (res.statusCode === 496) {
                return callback(new Error(ERRORS.validation['496']));
            } else if (res.statusCode === 497) {
                return callback(new Error(ERRORS.validation['497']));
            } else if (res.statusCode === 498) {
                return callback(new Error(ERRORS.validation['498']));
            } else if (res.statusCode === 500) {
                return callback(new Error(ERRORS.validation['500']));
            } else if (res.statusCode === 200) {

                purchase['status'] = 1;

                return callback(null, purchase);

            }

        });
    };

     function getPurchaseData (purchase) {
        var data;

        if (!purchase) {
            return null;
        }

        data = {
            receiptId: purchase.purchaseToken,
            productId: purchase.productId,
            purchaseDate: new Date(), //TODO: check
            quantity: 1,
            receipt: JSON.stringify(purchase)
        };

        return data;

    };

    return {
        readConfig       : readConfig,
        setup            : setup,
        validatePurchase : validatePurchase,
        getPurchaseData  : getPurchaseData
    };

};