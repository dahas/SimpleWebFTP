var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var path = require('path');

module.exports = function() {

    var app = express();
    app.use(express.static(path.join(__dirname, '../view')));
    app.use(bodyParser());

    if (process.env.NODE_ENV !== 'production') {
        require('longjohn');
    }

    app.use(cookieParser());

    var ftp = require("../controller/ftp.ctrl.srv");

    app.route('/Connect').post(ftp.connect);
    app.route('/Disconnect').post(ftp.disconnect);

    app.route('/RemoteFolders').get(ftp.listRemoteFolders);
    app.route('/RemoteFiles').get(ftp.listRemoteFiles);
    app.route('/UploadFile').post(ftp.uploadFile);
    app.route('/DeleteRemoteFile').post(ftp.deleteRemoteFile);

    app.route('/LocalDisks').get(ftp.listLocalDisks);
    app.route('/LocalFolders').get(ftp.listLocalFolders);
    app.route('/LocalFiles').get(ftp.listLocalFiles);
    app.route('/DownloadFile').post(ftp.downloadFile);

    return app;

}