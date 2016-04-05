var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var path = require('path');

if (process.env.NODE_ENV !== 'production') {
    require('longjohn');
}

module.exports = function() {

    var app = express();

    app.set("views", "./view");
    app.set("view engine", "ejs");

    app.use(express.static(path.join(__dirname, '../view')));
    app.use(bodyParser());
    app.use(cookieParser());

    var ftp = require("../controller/ftp.ctrl.srv");

    app.get('/', ftp.launch);

    app.route('/Connect').post(ftp.connect);
    app.route('/Disconnect').post(ftp.disconnect);

    app.route('/RemoteFolders').get(ftp.listRemoteFolders);
    app.route('/RemoteFiles').get(ftp.listRemoteFiles);
    app.route('/UploadFile').post(ftp.uploadFile);
    app.route('/DeleteRemoteFile').post(ftp.deleteRemoteFile);
    app.route('/DeleteRemoteFolder').post(ftp.deleteRemoteFolder);
    app.route('/CreateRemoteDir').post(ftp.createRemoteDir);

    app.route('/LocalDisks').get(ftp.listLocalDisks);
    app.route('/LocalFolders').get(ftp.listLocalFolders);
    app.route('/LocalFiles').get(ftp.listLocalFiles);
    app.route('/DownloadFile').post(ftp.downloadFile);

    return app;

}