var blocktrail = require('./lib/api_client');

blocktrail.COIN = 100000000;
blocktrail.PRECISION = 8;

blocktrail.toSatoshi = function(btc) {
    return (btc * blocktrail.COIN).toFixed(0);
};

blocktrail.toBTC = function(satoshi) {
    return (satoshi / blocktrail.COIN).toFixed(blocktrail.PRECISION);
};

exports = module.exports = blocktrail;
