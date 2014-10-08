var RestClient = require('./rest_client');

var APIClient = function (options) {
    var self = this;

    if (!options.host) {
        options.host = 'api.blocktrail.localhost';
    }

    if (!options.endpoint) {
        options.endpoint = "/" + (options.apiVersion || "v1") + "/" + (options.testnet ? "t" : "") + (options.network || 'BTC').toUpperCase();
    }

    /**
     * @type RestClient
     */
    self.client = RestClient(options);
};

APIClient.prototype.address = function(address, cb) {
    var self = this;

    return self.client.get("/address/" + address, null, cb);
};

APIClient.prototype.address_transactions = function(address, params, cb) {
    var self = this;

    return self.client.get("/address/" + address + "/transactions", params, cb);
};

APIClient.prototype.address_unconfirmed_transactions = function(address, params, cb) {
    var self = this;

    return self.client.get("/address/" + address + "/unconfirmed-transactions", params, cb);
};

APIClient.prototype.address_unspent_outputs = function(address, params, cb) {
    var self = this;

    return self.client.get("/address/" + address + "/unspent-outputs", params, cb);
};

APIClient.prototype.verify_address = function(address, signature, cb) {
    var self = this;

    return self.client.post("/address/" + address + "/verify", null, {signature: signature}, cb);
};

APIClient.prototype.all_blocks = function(params, cb) {
    var self = this;

    return self.client.get("/all-blocks", params, cb);
};

APIClient.prototype.block = function(block, cb) {
    var self = this;

    return self.client.get("/block/" + block, null, cb);
};

APIClient.prototype.block_latest = function(cb) {
    var self = this;

    return self.client.get("/block/latest", null, cb);
};

APIClient.prototype.block_transactions = function(block, params, cb) {
    var self = this;

    return self.client.get("/block/" + block + "/transactions", params, cb);
};

APIClient.prototype.transaction = function(tx, cb) {
    var self = this;

    return self.client.get("/transaction/" + tx, null, cb);
};

module.exports = function(options) {
    return new APIClient(options);
};
