process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1'

process.on('uncaughtException', function (err) {
    console.log(err);
});

var express = require("./config/express");
module.exports = express().listen(server_port, server_ip_address, function () {
    console.log("Listening on " + server_ip_address + ", server_port " + server_port + ", in mode '" + process.env.NODE_ENV + "'.")
});