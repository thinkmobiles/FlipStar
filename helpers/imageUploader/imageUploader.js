var imageUploader = function (config) {
    'use strict';

    if (!config || !config.type) {
        console.warn( 'method expects a config object\n'
            + 'with property: type ("AmazonS3" or "FileSystem")\n');
        return null;
    }

    var imageUploadImpl;

    if (config.type === 'AmazonS3') {
        if (!config.awsConfig) {
            console.warn('method expects aws config object\n'
                + 'with fields: "accessKeyId", "secretAccessKey", "imageUrlDurationSec"\n');
            return null;
        }
        imageUploadImpl = require('./imageAmazonS3') (config.awsConfig);
    }

    if (config.type === 'FileSystem') {
        if (!config.directory) {
            console.warn( 'method expects config "directory"\n');
            return null;
        }
        imageUploadImpl = require('./imageFileSystem') (config.directory);
    }

    return {
        uploadImage: imageUploadImpl.uploadImage,
        duplicateImage: imageUploadImpl.duplicateImage,
        removeImage: imageUploadImpl.removeImage,
        getImageUrl: imageUploadImpl.getImageUrl
    };
};

module.exports = imageUploader;