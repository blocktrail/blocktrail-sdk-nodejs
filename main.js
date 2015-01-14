var APIClient = require('./lib/api_client');
var blocktrail = require('./lib/blocktrail');

Object.keys(blocktrail).forEach(function(key) {
    APIClient[key] = blocktrail[key];
});

exports = module.exports = APIClient;
