/**
 * Created by migal on 29.07.15.
 */

var express = require('express');
var router = express.Router();
var PurchaseHandler = require('../handlers/purchase');

module.exports = function(PostGre){
    var purchase = new PurchaseHandler(PostGre);

    router.post('/buyItem', purchase.buyItems);

    router.post('/pack', purchase.addPack);
    router.delete('/pack', purchase.deletePack);

    return router;
};