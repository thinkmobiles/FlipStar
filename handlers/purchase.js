/**
 * Created by migal on 27.07.15.
 */

var TABLES = require('../constants/tables');
var MODELS = require('../constants/models');
var CONSTANTS = require('../constants/constants');
var RESPONSES = require('../constants/responseMessages');
var GameProfileHelper = require('../helpers/gameProfile');
var async = require('async');
var PurchaseHandler = require('../helpers/purchase');
var _ = require('lodash');


Purchase = function(PostGre){
    'use strict';
    var iap = new PurchaseHandler(PostGre);
    var GameProfileModel = PostGre.Models[MODELS.GAME_PROFILE];
    var PurchaseModel = PostGre.Models[MODELS.KIOSK];
    var PurchaseHistoryModel = PostGre.Models[MODELS.USERS_PURCHASES];
    var BoostersModel = PostGre.Models[MODELS.BOOSTERS];

    var gameProfile = new GameProfileHelper(PostGre);

    var buy = {
        stars    : buyStars,
        flips    : buyFlips,
        coins    : buyCoins,
        boosters : buyBoosters,
        packs    : buyPacks
    };

    // helpers function
    function daysBetweenDates (dateString1, dateString2){
        var d1 = new Date(dateString1);
        var d2 = new Date(dateString2);

        return Math.floor(Math.abs((d1.getTime() - d2.getTime()) / (24 * 60 * 60 * 1000)));
    }

    function saveToHistory (saveObj, callback){

       PurchaseHistoryModel
            .forge(saveObj)
            .save()
            .then(function(){
                callback(null);
            })
            .otherwise(callback);

    }

    function buyStars(validReceipt, data, callback) {

        var gameProfId = data.gameProfile;
        var currentStars;
        var countStars;
        var purchase;
        var packageId;
        var saveObj;
        var err;
        var currentGameProfileModel = new GameProfileModel({'id': gameProfId});

        currentGameProfileModel
            .fetch()
            .then(function (resultProfileModel) {

                if (!resultProfileModel) {

                    err = new Error(RESPONSES.DATABASE_ERROR);
                    err.status = 400;
                    return callback(err);

                }

                packageId = validReceipt.productId;

                purchase = new PurchaseModel({'store_item_id': packageId, 'type': 'stars'});

                purchase
                    .fetch()
                    .then(function (resultModel) {

                        countStars = resultModel.get('value');
                        currentStars = resultProfileModel.get('stars_number');

                        currentGameProfileModel
                            .save({'stars_number': currentStars + countStars}, {patch: true})
                            .then(function () {

                                //TODO check purchase history
                                //todo add to user_purchase table field receipt

                                saveObj = {
                                    'game_profile_id': parseInt(gameProfId),
                                    'purchase_id': 1,
                                    'recipe_id': validReceipt.receiptId
                                };


                                saveToHistory(saveObj, callback);

                            })
                            .otherwise(callback);
                    })
                    .otherwise(callback);
            })
            .otherwise(callback);
    };

    function buyFlips(validReceipt, data, callback) {

        var gameProfId = data.gameProfile;
        var currentFlips;
        var countFlips;
        var purchase;
        var saveObj;
        var packageId;
        var currentGameProfileModel = new GameProfileModel({'id': gameProfId});
        var err;

        currentGameProfileModel
            .fetch()
            .then(function (resultProfileModel) {

                if (!resultProfileModel) {

                    err = new Error(RESPONSES.DATABASE_ERROR);
                    err.status = 400;
                    return callback(err);

                }

                packageId = validReceipt.productId;

                purchase = new PurchaseModel({'store_item_id': packageId, 'type': 'flips'});

                purchase
                    .fetch()
                    .then(function (resultModel) {
                        countFlips = resultModel.get('value');
                        currentFlips = resultProfileModel.get('flips_number');

                        resultProfileModel
                            .save({'flips_number': currentFlips + countFlips}, {patch: true})
                            .then(function () {

                                saveObj = {
                                    'game_profile_id': parseInt(gameProfId),
                                    'purchase_id': 1,
                                    'recipe_id': validReceipt.receiptId
                                };

                                saveToHistory(saveObj, callback);

                            })
                            .otherwise(callback);
                    })
                    .otherwise(callback);
            })
            .otherwise(callback);

    }

    function buyCoins (validReceipt, data, callback) {

        var gameProfId = data.gameProfile;
        var currentCoins;
        var purchase;
        var saveObj;
        var packageId;
        var countCoins;
        var currentProfileModel = new GameProfileModel({'id': gameProfId});
        var err;

        currentProfileModel
            .fetch()
            .then(function (resultProfileModel) {

                if (!resultProfileModel) {

                    err = new Error(RESPONSES.DATABASE_ERROR);
                    err.status = 400;
                    return callback(err);

                }

                packageId = validReceipt.productId;

                purchase = new PurchaseModel({'store_item_id': packageId, 'type': 'coins'});

                purchase
                    .fetch()
                    .then(function (resultModel) {

                        if (!resultModel) {

                            err = new Error(RESPONSES.DATABASE_ERROR);
                            err.status = 400;
                            return next(err);

                        }

                        countCoins = resultModel.get('value');
                        currentCoins = resultProfileModel.get('coins_number');

                        resultProfileModel
                            .save({'coins_number': countCoins + currentCoins}, {patch: true})
                            .then(function () {

                                saveObj = {
                                    'user_id': parseInt(uId),
                                    'receipt_id': validReceipt.receiptId,
                                    'receipt': validReceipt.receipt
                                };

                                saveToHistory(saveObj, callback)

                            })
                            .otherwise(callback);

                    })
                    .otherwise(callback)

            })
            .otherwise(callback);
    }

    function buyBoosters(validReceipt, data, callback) {

        var gameProfId = data.gameProfile;
        var purchase;
        var packageId;
        var saveObj;
        var boosterId;
        var boosterName;
        var boosters;
        var err;

        packageId = validReceipt.productId;

        function getBoosterName(packageId, cb) {
            purchase = new PurchaseModel({'store_item_id': packageId, 'type': 'boosters'});

            purchase
                .fetch()
                .then(function (resultModel) {

                    if  (!resultModel){
                        err = new Error(RESPONSES.DATABASE_ERROR);
                        err.status = 400;
                        cb(err);
                    }

                    boosterName = resultModel.get('name');

                    return cb(null, boosterName);
                })
                .otherwise(cb)
        }

        function getBoosterId(boosterName, cb) {
            boosters = new BoostersModel({'name': boosterName});

            boosters
                .fetch()
                .then(function (resultModel) {
                    boosterId = resultModel.get('id');

                    return cb(null, boosterId);
                })
                .otherwise(cb);
        }


        function saveBoosterToUser(gameProfId, boosterId, cb) {

            PostGre.knex
                .raw('SELECT buy_booster ( ' + gameProfId + ', ' +  boosterId + ' )')
                .exec(function(err){

                    if (err) {
                        cb(err);
                    }

                    cb(null);
                });

        }


        function savePurchaseToHistory(cb) {
            saveObj = {
                'game_profile_id': parseInt(gameProfId),
                'purchase_id': 1,
                'recipe_id': validReceipt.receiptId
            };

            saveToHistory(saveObj, cb);
        }


        async.waterfall([
            async.apply(getBoosterName, packageId),
            getBoosterId,
            async.apply(saveBoosterToUser, gameProfId),
            savePurchaseToHistory
        ], function (err) {
            if (err) {
                return callback(err);
            }

            callback(null)
        })

    }


    function getSmashesForPack(userGroup, allSmashes, smashObj, cb){

        var probabilitySmashes = [];
        var probability;
        var countNewSmashes;
        var nonOwnedSmashes;
        var counter = 0;
        var randomIndex;
        var takenSmashes = [];
        var nSmashes;
        var ownedSmashes = smashObj.ownedSmashes;
        var newSmashes = smashObj.newSmashes;

        switch(userGroup){
            case CONSTANTS.PURCHASE_GROUP_USERS.GROUP_A: {
                probability = 30;
            }
                break;

            case CONSTANTS.PURCHASE_GROUP_USERS.GROUP_B: {
                probability = 50;
            }
                break;

            case CONSTANTS.PURCHASE_GROUP_USERS.GROUP_C: {
                probability = 75;
            }
                break;

            default: {
                probability = lodash.random(2, 9) * 10 - 5;
            }
                break;
        }

        countNewSmashes = probability / 5;

        nonOwnedSmashes = _.difference(allSmashes, ownedSmashes);

        if (!ownedSmashes.length){
            while (counter < 100){
                randomIndex = _.random(0, nonOwnedSmashes.length - 1);

                probabilitySmashes.push(nonOwnedSmashes[randomIndex]);

                counter += 1;
            }
        } else {
            while (counter < countNewSmashes){
                randomIndex = _.random(0, nonOwnedSmashes.length - 1);

                probabilitySmashes.push(nonOwnedSmashes[randomIndex]);

                counter += 1;
            }

            counter = 0;

            while (counter <= 99 - countNewSmashes){
                randomIndex = _.random(0, ownedSmashes.length - 1);

                probabilitySmashes.push(ownedSmashes[randomIndex]);

                counter += 1;
            }
        }

        counter = 0;

        while (counter < 5){
            randomIndex = _.random(0, probabilitySmashes.length - 1);

            takenSmashes.push(probabilitySmashes[randomIndex]);

            counter += 1;
        }

        nSmashes = _.intersection(nonOwnedSmashes, takenSmashes);

        ownedSmashes = _.union(ownedSmashes, nSmashes);

        newSmashes = newSmashes.concat(takenSmashes);

        smashObj.ownedSmashes = ownedSmashes;
        smashObj.newSmashes = newSmashes;

        cb(null);
    }

    function getUserSmashes (gameProfileId, cb) {

        PostGre.knex
            .select('smash_id')
            .from(TABLES.USERS_SMASHES)
            .where({game_profile_id: gameProfileId})
            .exec(function(err, resultRows){
                if (err){
                    return cb(err);
                }

                if (!resultRows){
                    err = new Error(RESPONSES.DATABASE_ERROR);
                    err.status = 400;
                    return cb(err);
                }

                cb(null, resultRows);
            });
    }

    function getAllSmashes(cb){

        PostGre.knex
            .select('id')
            .from(TABLES.SMASHES)
            .exec(function(err, resultRows){
                if (err){
                    return cb(err);
                }

                if (!resultRows.length){
                    err = new Error(RESPONSES.DATABASE_ERROR);
                    err.status = 400;
                    return cb(err);
                }

                cb(null, resultRows);
            });
    }

    function userToGroupA (userFirstLogin, userPurchases) {

        var firstLogin = new Date(userFirstLogin);
        var firstPurchase;

        if (!userPurchases.length){
            return false;
        } else {

            firstPurchase = new Date(userPurchases[userPurchases.length - 1]);

            if (userPurchases.length >= 5) {
                return true;
            }

            if (firstLogin.getYear() === firstPurchase.getYear() && firstLogin.getMonth() === firstPurchase.getMonth() && firstLogin.getDate() === firstPurchase.getDate()) {
                return true;
            }

        }

    }

    function userToGroupB (userFirstLogin, userPurchases){

        var firstLogin = new Date(userFirstLogin);
        var firstPurchase;
        var purchaseCount;
        var bool = true;

        if (!userPurchases.length){
            return false;
        } else {

            firstPurchase = new Date(userPurchases[userPurchases.length - 1]);

            purchaseCount = userPurchases.length;


            if (daysBetweenDates(firstPurchase, firstLogin) === 3) {
                return true;
            }

            if (userPurchases.length <= 5){

                for (var i = purchaseCount - 1; i >= 1; i -= 1){
                    if (daysBetweenDates(userPurchases[i] - userPurchases[i - 1]) > 2){
                        bool = false;
                        break;
                    }
                }

                return bool;

            }

        }

    }

    function userToGroupC (userFirstLogin, userPurchases){

        var firstLogin = new Date(userFirstLogin);
        var firstPurchase;

        if (!userPurchases.length){
            return false;
        } else {

            firstPurchase = new Date(userPurchases[userPurchases.length - 1]);

            if (daysBetweenDates(firstPurchase, firstLogin) === 7) {
                return true;
            }

        }

    }

    function getUserGroup(gameProfileId, cb){

        var userGroup;
        var usersPurchase;
        var firstLoginDate;

        PostGre.knex
            .select('created_at')
            .from(TABLES.USERS_PURCHASES)
            .orderBy('created_at', 'desc')
            .where({'game_profile_id': gameProfileId})
            .exec(function(err, resultRows){
                if (err){
                    return cb(err);
                }

                usersPurchase = _.pluck(resultRows, 'created_at');

                PostGre.knex
                    .select()
                    .from(TABLES.USERS_PROFILE)
                    .leftJoin(TABLES.GAME_PROFILE, TABLES.USERS_PROFILE + '.id', TABLES.GAME_PROFILE + '.user_id')
                    .where(TABLES.GAME_PROFILE + '.id', gameProfileId)
                    .exec(function(err, resDate){

                        if (err){
                            return cb(err);
                        }

                        if (!resDate){
                            err = new Error(RESPONSES.DATABASE_ERROR);
                            err.status = 400;
                            return cb(err);
                        }

                        firstLoginDate = resDate[0].created_at;

                        if (userToGroupA(firstLoginDate, usersPurchase)){

                            userGroup = CONSTANTS.PURCHASE_GROUP_USERS.GROUP_A;

                        } else if (userToGroupB(firstLoginDate, resultRows)){

                            userGroup = CONSTANTS.PURCHASE_GROUP_USERS.GROUP_B;

                        } else if (userToGroupC(firstLoginDate, resultRows)){

                            userGroup = CONSTANTS.PURCHASE_GROUP_USERS.GROUP_C;

                        } else {

                            userGroup = 'other';

                        }

                        cb(null, userGroup);

                    });
            });

    }

    function buyPacks(validReceipt, data, callback){

        var gameProfId = data.gameProfile;
        var packageId;
        var purchase;
        var countPacks;
        var ownedSmashes;
        var allSmashes;
        var userGroup;
        var counter = 0;
        var groupedSmashes;
        var smashArray = [];
        var smashObj;
        var saveObj;
        var smashObject = {};
        var newSm;
        var options;

        packageId = validReceipt.productId;

        purchase = new PurchaseModel({'store_item_id': packageId, 'type': 'packs'});

        purchase
            .fetch()
            .then(function (resultModel) {

                countPacks = resultModel.get('value');

                async.parallel([
                    async.apply(getAllSmashes),
                    async.apply(getUserSmashes, gameProfId),
                    async.apply(getUserGroup, gameProfId)
                ], function (err, results) {

                    if (err) {
                        return callback(err);
                    }

                    if (!results || !results.length || !results[0] || !results[1] || !results[2]) {
                        err = new Error(RESPONSES.DATABASE_ERROR);
                        err.status = 400;
                        return callback(err);
                    }

                    ownedSmashes = _.pluck(results[1], 'smash_id');
                    allSmashes = _.pluck(results[0], 'id');
                    userGroup = results[2];

                    smashObject.ownedSmashes = ownedSmashes;
                    smashObject.newSmashes = [];

                    async.whilst(
                        function () {
                            return counter < countPacks
                        },
                        function (cb) {
                            getSmashesForPack(userGroup, allSmashes, smashObject, function(){
                                counter += 1;
                                cb(null);
                            });

                        },
                        function (err) {
                            if (err) {
                                return callback(err);
                            }
                            newSm = smashObject.newSmashes;

                            groupedSmashes = _.groupBy(newSm);

                            async.each(groupedSmashes, function (sm, cb) {

                                smashObj = {
                                    id: sm[0],
                                    quantity: sm.length
                                };

                                smashArray.push(smashObj);
                                cb(null);

                            }, function (err) {
                                if (err) {
                                    return callback(err);
                                }

                                options = {
                                    uid: gameProfId,
                                    smashes: smashArray
                                };

                                gameProfile.addSmashes(options, function (err) {
                                    if (err) {
                                        return callback(err);
                                    }

                                    saveObj = {
                                        'game_profile_id': parseInt(gameProfId),
                                        'purchase_id': 1,
                                        'recipe_id': validReceipt.receiptId
                                    };


                                    saveToHistory(saveObj, callback);
                                });
                            });

                        }
                    )


                });


            })
            .otherwise(callback);
    }

    function buyOpeningSmash(gameProfId, smashId, receipt, os, callback){

        function isOpenSmash(gameProfId, smashId, cb){
            PostGre.knex
                .select('isOpen')
                .from(TABLES.USERS_SMASHES)
                .where({'smash_id': smashId, 'game_profile_id': gameProfId})
                .exec(function(err, result){

                    if (err){
                        return cb(err);
                    }

                    if (!result.length){

                    }

                    if (!result[0].isOpen){
                        return cb(null, false, receipt, os);
                    }

                    cb(null, true, receipt, os);

                });
        }

        function validateReceipt(isOpenSmash, receipt, os, cb){
            var packageId;
            var purchase;
            var setId;

            if (!isOpenSmash){

                iap.validateReceipt(receipt, os, function(err, validReceipt){

                    if (err){

                        return cb(err);

                    }

                    packageId = validReceipt.productId;

                    purchase = new PurchaseModel({'store_item_id': packageId});

                    purchase
                        .fetch()
                        .then(function(resultModel){

                            if (!resultModel){

                                err = new Error(RESPONSES.DATABASE_ERROR);
                                err.status = 400;
                                return cb(err);

                            }

                            setId = resultModel.get('value');

                            PostGre.knex
                                .select()
                                .from(TABLES.SMASHES)
                                .where({'id': smashId, 'set': setId})
                                .limit(1)
                                .exec(function(err, resultRow){

                                    if (err){
                                        return cb(err);
                                    }

                                    if (resultRow.length){
                                        return cb(null, validReceipt, gameProfId);
                                    }

                                    return cb(null);

                                });

                        })
                        .otherwise(cb)


                })

            } else {

                return cb(null)

            }

        }

        function savePurchaseHistory(validReceipt, gameProfId, cb){

            var saveObj = {
                'user_id': parseInt(gameProfId),
                'receipt_id': validReceipt.receiptId,
                'receipt': validReceipt.receipt
            };

            saveToHistory(saveObj, cb);

        }


        async.waterfall([
            async.apply(isOpenSmash, gameProfile, smashId),
            validateReceipt,
            savePurchaseHistory

        ], function(err){

            if (err){
                return callback(err);
            }

            callback(smashId);

        })


    }

    this.buyItems = function(req, res, next){

        var body = req.body;
        var receipt;
        var os;
        var type;
        //var data;
        var errArray = [];
        var errObj;
        var err;
        var data = {
            gameProfile: req.session.uId
        };

        var validReceipt;

        // TODO body must be an array

        async.forEachOf(body, function(item, key, cb){

            // todo use with validation receipts
            /*receipt = item.receipt;
            os = item.os;
            type = item.type;
            data = item.data;*/

            validReceipt = item.receipt;
            type = item.type;

            /*iap.validateReceipt(receipt, os, function(err, validReceipt){

                if (err){

                    errObj = {
                        err: err,
                        index: key
                    };

                    errArray.push(errObj);
                    return cb(null);
                }*/

                if (!buy.hasOwnProperty(type)){

                    err = new Error(RESPONSES.INVALID_PARAMETERS);
                    err.status = 400;
                    return cb(err);

                }

                buy[type](validReceipt, data, function(err){

                    if (err){

                        errObj = {
                            err: err,
                            index: key
                        };

                        errArray.push(errObj);
                        return cb(null);
                    }

                    cb(null)

                });

           /* });*/

        }, function(err){

            if (err){
                return next(err);
            }

            if (errArray.length){

                res.status(400).send({error: errArray});

            } else {

                res.status(200).send({success: RESPONSES.BOUGHT});

            }

        });

    };

    // TODO test handler for filling and deleting rows from purchase table

    this.addPack = function(req, res, next){
        var body = req.body;

        var insertObj = {
            type: body.type,
            name: body.name,
            store: body.store,
            value: body.value,
            store_item_id: body.packageId
        };

        var purchase = new PurchaseModel({name: body.name});

        purchase
            .fetch()
            .exec(function(err, model){
                if (err){
                    return next(err);
                }

                if (!model){
                    PurchaseModel
                        .forge(insertObj)
                        .save()
                        .exec(function(err){

                            if (err){
                                return next(err);
                            }

                            res.status(200).send({success: 'Pack saved successfully'});

                        });
                } else {
                    purchase
                        .save(insertObj, {patch: true})
                        .exec(function(err){

                            if (err){
                                return next(err);
                            }

                            res.status(200).send({success: 'Pack updated successfully'});

                        });
                }
            });

    };

    this.deletePack = function(req, res, next){
        var body = req.body;

        var deleteObj = {
            id: body.id
        };

        PurchaseModel
            .forge(deleteObj)
            .destroy()
            .exec(function(err){
                if (err){
                    return next(err);
                }

                res.status(200).send({success: 'deleted successfully'});

            });

    };

};

module.exports = Purchase;