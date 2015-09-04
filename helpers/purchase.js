var async = require('async');
var iap = require('./in-app-purchase');
var MODELS = require('../constants/models');
var RESPONSES = require('../constants/responseMessages');

iap.config({
    applePassword: "",
    googlePublicKeyPath: "",
    amazonOptions: {
        email: '',
        key: ''
    }
});

var Purchase = function(PostGre){

    var HistoryModel = PostGre.Models[MODELS.USERS_PROFILE];

    function checkReceipt (receipt, seller, callback){
        var sellerType;
        var err;

        switch (seller){
            case 'APPLE': {
                sellerType = iap.APPLE;
            }
                break;

            case 'GOOGLE': {
                sellerType = iap.GOOGLE;
            }
                break;

            case 'AMAZON': {
                sellerType = iap.AMAZON;
            }
                break;

            default: {
                err = new Error('Purchasing not implemented yet');
                err.status = 400;
                return callback(err);
            }
        }

        iap.setup(function(err) {

            if (err){
               return callback(err);
            }

            iap.validate(sellerType, receipt, function(err, receiptResult){

                if (err){
                    return callback(err);
                }

                if (!iap.isValidated(receiptResult)){
                    err = new Error(RESPONSES.NOT_VALID_RECEIPT);
                    err.status = 400;
                    return callback(err);
                }

                callback(null, iap.getPurchaseData(receiptResult));

            });
        });
    }

    function isUsed(receiptId, callback){
        var currentModel = new HistoryModel({'receipt_id': receiptId});
        var err;

        currentModel
            .fetch()
            .then(function(model){
                if (model){
                    err = new Error(RESPONSES.RECEIPT_USED);
                    err.status = 400;
                    return callback(err);
                }

                callback(null);
            })
            .otherwise(callback)
    }

     this.validateReceipt = function(receipt, os, callback){

        checkReceipt(receipt, os, function(err, validatedData){
            if (err){
                return callback(err);
            }

            isUsed(receipt, function(err){
               if (err){
                   return callback(err);
               }

                return callback(null, validatedData);
            });
        });
    };


};

module.exports = Purchase;