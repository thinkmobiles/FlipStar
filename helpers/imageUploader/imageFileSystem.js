var imagesUploader = function (dirConfig) {
    "use strict";

    var rootDir = dirConfig;

    var defaultUploadsDir = 'uploads';
    var defaultImageDir = 'images';

    var fs = require('fs');
    var os = require('os');
    var http = require('http');
    var https = require('https');

    var BASE64_REGEXP =/^data:image\/\w+;base64,/;
    var URL_REGEXP =/^http/;

    var ALLOWED_DOWNLOAD_TYPES = ['jpg', 'jpeg', 'png'];

    var osPathData = getDirAndSlash();

    function getDirAndSlash() {
        var osType = (os.type().split('_')[0]);
        var slash;
        var dir, webDir;
        switch (osType) {
            case "Windows":
            {
                dir = __dirname.replace("helpers\\imageUploader", rootDir + "\\");
                webDir = process.env.HOST;
                slash = "\\";
            }
                break;
            case "Linux":
            {
                dir = __dirname.replace("helpers/imageUploader", rootDir + "\/");
                webDir = process.env.HOST;
                slash = "\/";
            }
        }

        return {dir: dir, slash: slash, webDir: webDir}
    }

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

            if (imageTypeDetected[1] === "svg+xml") {
                imageData.extention = "svg";
            } else {
                imageData.extention = imageTypeDetected[1];
            }
        }

        callback(null, imageData);
    }

    function writer(path, imageData, callback) {
        var imageNameWithExt = imageData.name + '.' + imageData.extention;
        var imagePath = path + imageNameWithExt;

        try {
            fs.writeFile(imagePath, imageData.data, function (err, data) {
                if (callback && typeof callback === 'function') {
                    callback(err, imageNameWithExt)
                }
            });
        }
        catch (err) {
            console.log('ERROR:', err);
            if (callback && typeof callback === 'function') {
                callback(err)
            }
        }
    }

    function getImagePath(imageName, folderName) {
        var folder = folderName || defaultImageDir;

        return "http://" + osPathData.webDir + "\/" + defaultUploadsDir + "\/" + folder + "\/" + imageName;
    }

    function uploadImage(imageData, imageName, folderName, callback) {
        var slash = osPathData.slash;
        var dir = osPathData.dir + defaultUploadsDir + slash;
        var webDir = osPathData.webDir + defaultUploadsDir + slash + folderName + slash + imageName;

        if (BASE64_REGEXP.test(imageData) || !URL_REGEXP.test(imageData)) {
            encodeFromBase64(imageData, function (err, data) {
                if (err) {
                    if (callback && typeof callback === 'function') {
                        return callback(err);
                    } else {
                        return err;
                    }
                }
                data.name = imageName;
                saveImage(data, dir, folderName, slash, callback);
            });
        } else {
            uploadImageByUrl(imageData, imageName, folderName, callback);
        }
    }

    function uploadImageByUrl(imageUrl, imageName, folderName, callback) {
        checkUploadDirectory(folderName, null, null, function(err, dir){
            if (err) {
                if (callback && typeof callback === 'function') {
                    callback(err)
                }
            } else {
                //var contentType = res.headers['content-type'];
                var _imageUrl = imageUrl.split(".");
                var type = (_imageUrl.length ? _imageUrl[_imageUrl.length-1] : 'error');
                if (ALLOWED_DOWNLOAD_TYPES.indexOf(type) !== -1) {
                    var imageNameWithExt = imageName + "." + type;

                    var path = dir + imageNameWithExt;

                    var requester;
                    if (/^https/.test(imageUrl)) {
                        requester = https;
                    } else {
                        requester = http;
                    }

                    var writeStream = fs.createWriteStream(path);

                    requester.get(imageUrl, function(res) {
                        res.pipe(writeStream);
                        writeStream.on('finish', function() {
                            if (callback && typeof callback === 'function') {
                                callback(null, imageNameWithExt)
                            }
                            writeStream.close();

                        });
                        writeStream.on('error', function (err) {
                            fs.unlink(path);
                            if (callback && typeof callback === 'function') {
                                callback(err)
                            }
                        });
                    });

                } else {
                    if (callback && typeof callback === 'function') {
                        callback('Doesn\'t not allow download type');
                    }
                }
/*
                var _imageUrl = imageUrl.split(".");
                var type = (_imageUrl.length ? _imageUrl[_imageUrl.length-1] : 'txt');
                if (ALLOWED_DOWNLOAD_TYPES.indexOf(type) !== -1) {
                    var imageNameWithExt = imageName + "." + type;

                    var path = dir + imageNameWithExt;

                    var requester;
                    if (/^https/.test(imageUrl)) {
                        requester = https;
                    } else {
                        requester = http;
                    }

                    try {
                        var writeStream = fs.createWriteStream(path);

                        requester.get(imageUrl, function(res) {
                            res.pipe(writeStream);
                            writeStream.on('finish', function() {
                                if (callback && typeof callback === 'function') {
                                    callback(null, imageNameWithExt)
                                }
                                writeStream.close();

                            });
                            writeStream.on('error', function (err) {
                                fs.unlink(path);
                                if (callback && typeof callback === 'function') {
                                    callback(err)
                                }
                            });
                        });
                    }
                    catch (err) {
                        console.log('ERROR:', err);
                        if (callback && typeof callback === 'function') {
                            callback(err)
                        }
                    }
                } else {
                    if (callback && typeof callback === 'function') {
                        callback({error: "Doesn't not allow download type"});
                    }
                }*/
            }
        });
    }

    function checkUploadDirectory(folderName, dir, slash, callback) {
        if (!slash) {
            slash = osPathData.slash;
        }
        if (!dir) {
            dir = osPathData.dir + defaultUploadsDir + slash;
        }

        fs.readdir(dir, function (err) {
            if (err) {
                fs.mkdir(dir, function (err) {
                    if (!err) {
                        dir += folderName + slash;
                        fs.mkdir(dir, function (err) {
                            if (callback && typeof callback === 'function') {
                                callback(err, dir);
                            }
                        });
                    } else {
                        if (callback && typeof callback === 'function') {
                            callback(err, dir);
                        }
                    }
                });
            } else {
                dir += folderName + slash;
                fs.readdir(dir, function (err) {
                    if (!err) {
                        if (callback && typeof callback === 'function') {
                            callback(err, dir);
                        }
                    } else {
                        fs.mkdir(dir, function (err) {
                            if (callback && typeof callback === 'function') {
                                callback(err, dir);
                            }
                        });
                    }
                });
            }
        });
    }

    function saveImage(data, dir, folderName, slash, callback){
        checkUploadDirectory(folderName, dir, slash, function(err, dir){
            if (err) {
                if (callback && typeof callback === 'function') {
                    callback(err)
                }
            } else {
                writer(dir, data, callback);
            }
        });
    }

    function duplicateImage(path, imageName, folderName, callback) {
        var slash = osPathData.slash;
        var dir = osPathData.dir + defaultUploadsDir + slash;
        var imageData ={};

        path = osPathData.dir + path;

        imageData.extention = path.substring(path.lastIndexOf('.') + 1);
        imageData.name = imageName;

        fs.readFile(path, function (err, data) {
            if (err) {
                if (callback && typeof callback === 'function') {
                    callback(err)
                }
            } else {
                imageData.data = data;
                saveImage(imageData, dir, folderName, slash, callback);
            }
        });
    }

    function removeImage(imageName, folderName, callback) {
        var imageDir = defaultImageDir;
        if (folderName) {
            if (typeof folderName === 'function') {
                callback = folderName;
            } else {
                imageDir = folderName;
            }
        }
        var imagePath = rootDir + osPathData.slash + defaultUploadsDir + osPathData.slash + imageDir + osPathData.slash + imageName;
        fs.unlink(imagePath, function (err) {
            if (callback && typeof callback === 'function') {
                callback(err);
            }
        });
    }

    return {
        uploadImage: uploadImage,
        duplicateImage: duplicateImage,
        removeImage: removeImage,
        getImageUrl: getImagePath
    };
};

module.exports = imagesUploader;
