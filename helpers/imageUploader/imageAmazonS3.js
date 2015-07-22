var imageUploader = function (awsConfig) {
    "use strict";

    var AWS = require('aws-sdk');
    var amazonS3 = awsConfig;
    var s3 = new AWS.S3({ httpOptions: { timeout: 50000 } });
    var s3policy = require('s3policy');

    var http = require('http');
    var https = require('https');
    var fs = require('fs');

    var BASE64_REGEXP =/^data:image\/\w+;base64,/;
    var URL_REGEXP =/^http/;
    var ALLOWED_DOWNLOAD_TYPES = ['jpg','jpeg', 'png'];
    var GLOBAL_BUCKET = process.env.GLOBAL_BUCKET || 'diveplanitvir/development';


    function encodeFromBase64(dataString, callback) {
        if (!dataString) {
            callback({error: 'Invalid input string'});
            return;
        }

        var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        var imageData = {};

        if (!matches || matches.length !== 3) {
            if (/image\/png/.test(dataString)) {
                imageData.type = 'image/png';
                imageData.extention = 'png';
            } else if (/image\/jpeg/.test(dataString)) {
                imageData.type = 'image/jpeg';
                imageData.extention = 'jpeg';
            } else {
                imageData.type = 'image/jpg';
                imageData.extention = 'jpg';
            }

            try {
                imageData.data = new Buffer(dataString.replace(BASE64_REGEXP, ""), 'base64');
            } catch (err) {
                callback({error: 'Invalid input string'});
                return;
            }
        } else {
            imageData.type = matches[1];
            imageData.data = new Buffer(matches[2], 'base64');

            var imageTypeRegularExpression = /\/(.*?)$/;
            var imageTypeDetected = imageData
                .type
                .match(imageTypeRegularExpression);

            imageData.extention = imageTypeDetected[1];
        }

        callback(null, imageData);
    }

    function uploadImage(imageData, imageName, folder, callback) {
        if (BASE64_REGEXP.test(imageData) || !URL_REGEXP.test(imageData)) {
            encodeFromBase64(imageData, function (err, imageData) {
                if (err) {
                    if (callback && (typeof callback === 'function')) {
                        callback(err);
                    }
                    return;
                }
                var imageNameWithExt = imageName + '.' + imageData.extention;
                putObjectToAWS(folder, imageNameWithExt, imageData.data, function (err, imageUrl) {
                    if (callback && (typeof callback === 'function')) {
                        callback(err, imageNameWithExt);
                    }
                });
            })
        } else {
            uploadImageByUrl(imageData, imageName, folder, callback);
        }
    };

    function uploadImageByUrl(imageUrl, imageName, folderName, callback) {
        var requester;
        if (/^https/.test(imageUrl)) {
            requester = https;
        } else {
            requester = http;
        }

        requester.get(imageUrl, function(res) {
            var contentType = res.headers['content-type'];
            var _imageUrl = contentType.split("/");
            var type = (_imageUrl.length ? _imageUrl[_imageUrl.length-1] : 'error');
            if (ALLOWED_DOWNLOAD_TYPES.indexOf(type) !== -1) {
                var imageNameWithExt = imageName + "." + type;

                var params = {
                    ACL: 'public-read',
                    Bucket: GLOBAL_BUCKET || folderName,
                    Key: imageNameWithExt,
                    ContentType: res.headers['content-type'],
                    ContentLength: res.headers['content-length'],
                    Body: res
                };

                s3.putObject(params, function (err, data) {
                    if (callback && (typeof callback === 'function')) {
                        callback(err, imageNameWithExt);
                    }
                });

            } else {
                if (callback && typeof callback === 'function') {
                    callback({error: "Doesn't not allow download type"});
                }
            }
        });
    };

    function putObjectToAWS(bucket, key, body, callback) {
        s3.putObject({ACL: 'public-read', Bucket: GLOBAL_BUCKET || bucket, Key: key, Body: body}, function (err, data) {
            if (callback && (typeof callback === 'function')) {
                callback(err, data);
            }
        });
    };

    function removeImage(imageName, folder, callback) {
        removeObjectFromAWS(folder, imageName, function (err, imageUrl) {
            if (callback && (typeof callback === 'function')) {
                callback(err, imageUrl);
            }
        });
    };

    function removeObjectFromAWS(bucket, name, callback) {
        var params = {
            Bucket: GLOBAL_BUCKET || bucket,
            Key: name
        };
        s3.deleteObject(params, function (err, data) {
            if (callback && typeof callback === 'function') {
                callback(err, data);
            }
        });
    };

    function getImageUrl(name, folder) {
        return getObjectUrlFromAmazon(name, folder);
    };

    function getObjectUrlFromAmazon(name, bucket) {
        var myS3Account = new s3policy(amazonS3.accessKeyId, amazonS3.secretAccessKey);
        return myS3Account.readPolicy(name, GLOBAL_BUCKET || bucket, amazonS3.imageUrlDurationSec);
    };

    return {
        uploadImage: uploadImage,
        removeImage: removeImage,
        getImageUrl: getImageUrl
    };
};

module.exports = imageUploader;