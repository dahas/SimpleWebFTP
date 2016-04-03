/********** REMOTE DRIVE **********/

var fs = require('fs');
var JSFtp = require("jsftp");
var ftp = null;

/**
 * Connect to FTP server
 * @param req
 * @param res
 */
exports.connect = function (req, res) {
    var sessData = req.session;
    sessData.ftp_host = sessData.ftp_host || req.body.host;
    sessData.ftp_port = sessData.ftp_port || req.body.port;
    sessData.ftp_user = sessData.ftp_user || req.body.user;
    sessData.ftp_pass = sessData.ftp_pass || req.body.pass;
    if (sessData.ftp_host) {
        ftp = new JSFtp({host: sessData.ftp_host, port: sessData.ftp_port, user: sessData.ftp_user, pass: sessData.ftp_pass, debugMode: true});
        ftp.auth(sessData.ftp_user, sessData.ftp_pass, function (err, result) {
            if (result)
                res.send({connected: true, ftp_msg: "You are successfully connected.", msg_col: "green"});
            else {
                res.send({connected: false, ftp_msg: "Authorization failed.", msg_col: "red"});
            }
        });
    } else {
        res.send({connected: false, ftp_msg: "Please connect to your FTP-Server.", msg_col: ""});
    }
};

/**
 * Disconnect from FTP server
 * @param req
 * @param res
 */
exports.disconnect = function (req, res) {
    ftp.raw.quit(function (hadError, data) {
        if (!hadError) {
            req.session.destroy();
            res.cookie("connect.sid", "", { expires: new Date() });
            res.send({
                connected: false,
                ftp_msg: "Please connect to your FTP-Server.",
                msg_col: ""
            });
        } else {
            res.send({
                connected: true,
                ftp_msg: hadError,
                msg_col: "red"
            });
        }
    });
    ftp = null;
};

/**
 * List folders on remote drive
 * @param req
 * @param res
 */
exports.listRemoteFolders = function (req, res) {
    var currPath = req.query.parent ? req.query.parent : '';
    if (ftp) {
        ftp.ls(currPath, function (err, list) {
            if (!err) {
                if (currPath)
                    var data = loadRemoteFolders(list, currPath);
                else
                    var data = loadRootPath();
                res.send(data);
            } else {
                res.send({
                    connected: true,
                    ftp_msg: err,
                    msg_col: "red"
                });
            }
        });
    } else {
        res.send({
            connected: true,
            ftp_msg: "Please connect to your FTP-Server.",
            msg_col: "red"
        });
    }
};
function loadRootPath() {
    var data = [];
    data.push({ id: '/', value: "Root", open: false, data: {}});
    return data;
}
function loadRemoteFolders(list, currPath) {
    var data = [];
    list.forEach(function (item) {
        if (item.type == 1) {
            data.push({ id: currPath + '/' + item.name, value: item.name, data: {}});
        }
    });
    return {
        parent: currPath,
        data: data
    };
}

/**
 * List files of a selected remote folder
 * @param req
 * @param res
 */
exports.listRemoteFiles = function (req, res) {
    var currPath = req.query.parent ? req.query.parent : '/';
    if (ftp) {
        ftp.ls(currPath, function (err, list) {
            if (err) throw err;
            var data = loadRemoteFiles(list, currPath);
            res.send(data);
        });
    } else {
        res.send();
    }
};
function loadRemoteFiles(list, currPath) {
    var data = [];
    if (currPath == '/') currPath = '';
    list.forEach(function (item) {
        if (item.type == 0) {
            data.push({ id: currPath + '/' + item.name, value: item.name});
        }
    });
    return {
        data: data,
        ftp_msg: "Listing remote path: '" + currPath + "'",
        msg_col: "inherit"
    };
}

/**
 * Upload local file into selected remote folder
 * @param req
 * @param res
 */
exports.uploadFile = function (req, res) {
    if (ftp) {
        ftp.put(req.body.source, req.body.destination, function (hadError) {
            if (!hadError) {
                var fileName = req.body.destination.split("/").pop();
                res.send({
                    connected: true,
                    ftp_msg: "File '" + fileName + "' uploaded successfully!",
                    msg_col: "green"});
            } else {
                res.send({
                    connected: false,
                    ftp_msg: hadError,
                    msg_col: "red"
                });
            }
        });
    } else {
        res.send({
            connected: false,
            ftp_msg: "You are not connected!",
            msg_col: "red"
        });
    }
};

/**
 * Delete selected file from remote drive
 * @param req
 * @param res
 */
exports.deleteRemoteFile = function (req, res) {
    if (ftp) {
        ftp.raw.dele(req.body.file, function (hadError, data) {
            if (!hadError) {
                var fileName = req.body.file.split("/").pop();
                res.send({
                    connected: true,
                    ftp_msg: "File '" + fileName + "' deleted successfully!",
                    msg_col: "green"
                });
            } else {
                res.send({
                    connected: true,
                    ftp_msg: hadError,
                    msg_col: "red"
                });
            }
        });
    } else {
        res.send();
    }
};

/********** LOCAL DRIVES **********/

var drivelist = require('drivelist');

/**
 * List mounted local disks
 * @param req
 * @param res
 */
exports.listLocalDisks = function (req, res) {
    var data = [];
    var currPath = req.query.parent ? req.query.parent : '';
    drivelist.list(function (error, disks) {
        if (error) throw error;
        disks.sort(function (a, b) {
            return a.mountpoint.localeCompare(b.mountpoint);
        });
        disks.forEach(function (disk) {
            data.push({id: disk.mountpoint + '\\', value: disk.mountpoint, data: {}})
        });
        res.send({
            parent: '',
            data: data
        });
    });
};

/**
 * List folders on selected local drive
 * @param req
 * @param res
 */
exports.listLocalFolders = function (req, res) {
    var currPath = req.query.parent ? req.query.parent : '';
    fs.readdir(currPath, function (err, list) {
        if (!err) {
            var data = loadLocalFolders(list, currPath);
            res.send(data);
        } else {
            res.send({
                ftp_msg: "Permission denied!",
                msg_col: "red"
            });
        }
    });
};
function loadLocalFolders(list, currPath) {
    var data = [];
    list.forEach(function (item) {
        try {
            var curr = fs.statSync(currPath + item + '\\');
            if (typeof curr != 'undefined' && curr.isDirectory()) {
                data.push({id: currPath + item + '\\', value: item, data: {}})
            }
        } catch (e) {
            //console.log(e);
        }
    });
    return {
        parent: currPath,
        data: data
    };
};

/**
 * List files of a selected local folder
 * @param req
 * @param res
 */
exports.listLocalFiles = function (req, res) {
    var data = [];
    var currPath = req.query.parent ? req.query.parent : '';
    if (currPath) {
        fs.readdir(currPath, function (err, list) {
            if (!err) {
                if (list) {
                    data = loadLocalFiles(list, currPath, 'folders');
                    res.send(data);
                }
            } else {
                res.send({
                    data: data,
                    ftp_msg: "Permission denied!",
                    msg_col: "red"
                });
            }
        });
    } else {
        res.send(data);
    }
};
function loadLocalFiles(list, currPath, contentType) {
    var data = [];
    list.forEach(function (item) {
        try {
            var is_file = fs.statSync(currPath + item).isFile();
        } catch (e) {
        }
        if (typeof is_file != 'undefined' && is_file) {
            data.push({id: currPath + item, value: item})
        }
    });
    return {
        data: data,
        ftp_msg: "Listing local path: '" + currPath + "'",
        msg_col: "inherit"
    };
}

/**
 * Download remote file into selected local folder
 * @param req
 * @param res
 */
exports.downloadFile = function (req, res) {
    if (ftp) {
        ftp.get(req.body.source, req.body.destination, function (hadError) {
            if (!hadError) {
                var fileName = req.body.destination.split("\\").pop();
                res.send({
                    connected: true,
                    ftp_msg: "File '" + fileName + "' downloaded successfully!",
                    msg_col: "green"
                });
            }
        });
    } else {
        res.send({
            connected: false,
            ftp_msg: "You are not connected!",
            msg_col: "red"
        });
    }
};