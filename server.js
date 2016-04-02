process.env.NODE_ENV = process.env.NODE_ENV || 'development';

process.on('uncaughtException', function (err) {
    console.log(err);
});

if (process.env.NODE_ENV !== 'production') {
    require('longjohn');
}

var express = require('express');
var session = require('express-session');
var mongoDBStore = require('connect-mongodb-session')(session);
var bodyParser = require('body-parser');
var fs = require('fs');
var drivelist = require('drivelist');
var path = require('path');
var JSFtp = require("jsftp");

var app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser());

app.listen(9001);

console.log('Server running on localhost:9001 in mode: ' + process.env.NODE_ENV)


var store = new mongoDBStore({
    uri: 'mongodb://localhost:27017/connect_mongodb_session',
    collection: 'mySessions'
});

app.use(session({
    secret: 'DontTellAnyone',
    cookie: {
        //maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    },
    store: store
}));


var ftp = null;


app.post('/Connect', function (req, res) {
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
});

app.post('/Disconnect', function (req, res) {
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
});


app.get('/RemoteFolders', function (req, res) {
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
});

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

app.get('/RemoteFiles', function (req, res) {
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
});

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

app.post('/UploadFile', function (req, res) {
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
});

app.post('/DeleteRemoteFile', function (req, res) {
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
});


app.get('/LocalDisks', function (req, res) {
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
});

app.get('/LocalFolders', function (req, res) {
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
});

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
}

app.get('/LocalFiles', function (req, res) {
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
});

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

app.post('/DownloadFile', function (req, res) {
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
});

