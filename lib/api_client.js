var RestClient = require('./rest_client');

var APIClient = function (options) {
    var self = this;

    if (!options.host) {
        options.host = 'api.blocktrail.localhost';
    }

    if (!options.endpoint) {
        options.endpoint = "/" + (options.apiVersion || "v1") + "/" + (options.testnet ? "t" : "") + (options.network || 'BTC').toUpperCase();
    }

    self.client = RestClient(options);
};

APIClient.prototype.address = function(address, cb) {
    var self = this;

    self.client.get("/address/" + address, null, function(err, address) {
        cb(err, address);
    });
};

APIClient.prototype.address_transactions = function(address, params, cb) {
    var self = this;

    self.client.get("/address/" + address + "/transactions", params, function(err, address_txs) {
        cb(err, address_txs);
    });
};

APIClient.prototype.verify_address = function(address, signature, cb) {
    var self = this;

    self.client.post("/address/" + address + "/verify", null, {signature: signature}, function(err, result) {
        cb(err, result);
    });
};

module.exports = function(options) {
    return new APIClient(options);
};
