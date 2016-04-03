process.env.NODE_ENV = process.env.NODE_ENV || 'development';

process.on('uncaughtException', function (err) {
    console.log(err);
});

var express = require("./config/express");
module.exports = express().listen(9001);

console.log('Server running on localhost:9001 in mode: ' + process.env.NODE_ENV)