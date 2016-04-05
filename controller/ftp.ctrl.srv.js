var JSFtp = require("jsftp");
var drivelist = require('drivelist');
var fs = require('fs');

var ftp = null;

var title = "A <b>Simple Web-FTP</b> client using Webix UI components and a NodeJS server.";

/**
 * Render the GUI
 * @param req
 * @param res
 */
exports.launch = function (req, res) {
    var is_connected = false;
    if (req.cookies.ftp && req.cookies.con) {
        var ftpData = JSON.parse(req.cookies.ftp);
        ftp = new JSFtp({host: ftpData.ftp_host, port: ftpData.ftp_port, user: ftpData.ftp_user, pass: ftpData.ftp_pass, debugMode: true});
        ftp.auth(ftpData.ftp_user, ftpData.ftp_pass, function (err, result) {
            ftp.raw.stat(function (hadError, data) {
                if (!hadError) {
                    console.log(data.text);
                } else {
                    console.log(hadError);
                }
            });
            if (result) {
                is_connected = true;
            }
            res.render("index", {
                title: title,
                connected: is_connected,
                welcome: "Your are successfully connected.",
                welcome_col: "green"
            });
        });
    } else {
        res.render("index", {
            title: title,
            connected: is_connected,
            welcome: "Please connect to your FTP server.",
            welcome_col: ""
        });
    }
}

/**
 * Connect to FTP server
 * @param req
 * @param res
 */
exports.connect = function (req, res) {
    var ftpData = req.cookies.ftp ? JSON.parse(req.cookies.ftp) : {};
    ftpData.ftp_host = ftpData.ftp_host || req.body.host;
    ftpData.ftp_port = ftpData.ftp_port || req.body.port;
    ftpData.ftp_user = ftpData.ftp_user || req.body.user;
    ftpData.ftp_pass = ftpData.ftp_pass || req.body.pass;
    if (ftpData.ftp_host && ftpData.ftp_port && ftpData.ftp_user && ftpData.ftp_pass) {
        ftp = new JSFtp({host: ftpData.ftp_host, port: ftpData.ftp_port, user: ftpData.ftp_user, pass: ftpData.ftp_pass, debugMode: true});
        ftp.auth(ftpData.ftp_user, ftpData.ftp_pass, function (err, result) {
            if (result)
                res.send({connected: true, ftp_msg: "You are successfully connected.", msg_col: "green"});
            else if (err) {
                res.send({connected: false, ftp_msg: "You are already authorized.", msg_col: "red"});
            }
            else {
                res.send({connected: false, ftp_msg: "Authorization failed.", msg_col: "red"});
            }
        });
    } else {
        res.send({connected: false, ftp_msg: "Please enter the correct data of your FTP account and press 'connect'.", msg_col: ""});
    }
};

/**
 * Disconnect from FTP server
 * @param req
 * @param res
 */
exports.disconnect = function (req, res) {
    if (ftp) {
        ftp.raw.quit(function (hadError, data) {
            if (!hadError) {
                res.send({
                    connected: false,
                    ftp_msg: data.text,
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
    } else {
        res.send({
            connected: false,
            ftp_msg: "You have been disconnected.",
            msg_col: ""
        });
    }
};

/********** REMOTE DRIVE **********/

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
            connected: false,
            ftp_msg: "You are not connected!",
            msg_col: "red"
        });
    }
};
function loadRootPath() {
    var data = [];
    data.push({ id: '/', value: "Root", open: false, webix_kids: true});
    return data;
}
function loadRemoteFolders(list, currPath) {
    var data = [];
    list.forEach(function (item) {
        if (item.type == 1) {
            data.push({ id: currPath + '/' + item.name, value: item.name, webix_kids: true});
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
        res.send({
            connected: false,
            ftp_msg: "You are not connected!",
            msg_col: "red"
        });
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
    currPath = currPath.replace(/\/\//g, "/");
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
        ftp.raw.dele(req.body.file, function (err, data) {
            if (!err) {
                var fileName = req.body.file.split("/").pop();
                res.send({
                    connected: true,
                    ftp_msg: "File '" + fileName + "' deleted successfully!",
                    msg_col: "green"
                });
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
            connected: false,
            ftp_msg: "You are not connected!",
            msg_col: "red"
        });
    }
};

/**
 * Delete selected folder from remote drive
 * @param req
 * @param res
 */
exports.deleteRemoteFolder = function (req, res) {
    if (ftp) {
        ftp.raw.rmd(req.body.folder, function (err, data) {
            if (!err) {
                res.send({
                    removed: true,
                    ftp_msg: "The directory was successfully removed.",
                    msg_col: "green"
                });
            } else {
                res.send({
                    removed: false,
                    ftp_msg: "Cannot remove directory. Directory not empty!",
                    msg_col: "red"
                });
            }
        });
    } else {
        res.send({
            removed: false,
            ftp_msg: "You are not connected!",
            msg_col: "red"
        });
    }
};

exports.createRemoteDir = function(req, res) {
    if (ftp) {
        ftp.raw.mkd(req.body.foldername, function(err, data) {
            if (!err) {
                res.send({
                    connected: true,
                    ftp_msg: data.text,
                    msg_col: "green"
                });
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
            connected: false,
            ftp_msg: "You are not connected!",
            msg_col: "red"
        });
    }
};

/********** LOCAL DRIVE **********/

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