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

APIClient.prototype.address_unconfirmed_transactions = function(address, params, cb) {
    var self = this;

    self.client.get("/address/" + address + "/unconfirmed-transactions", params, function(err, address_txs) {
        cb(err, address_txs);
    });
};

APIClient.prototype.address_unspent_outputs = function(address, params, cb) {
    var self = this;

    self.client.get("/address/" + address + "/unspent-outputs", params, function(err, address_txs) {
        cb(err, address_txs);
    });
};

APIClient.prototype.verify_address = function(address, signature, cb) {
    var self = this;

    self.client.post("/address/" + address + "/verify", null, {signature: signature}, function(err, result) {
        cb(err, result);
    });
};

APIClient.prototype.all_blocks = function(params, cb) {
    var self = this;

    self.client.get("/all-blocks", params, function(err, result) {
        cb(err, result);
    });
};

APIClient.prototype.block = function(block, cb) {
    var self = this;

    self.client.get("/block/" + block, null, function(err, block) {
        cb(err, block);
    });
};

APIClient.prototype.block_latest = function(cb) {
    var self = this;

    self.client.get("/block/latest", null, function(err, result) {
        cb(err, result);
    });
};

APIClient.prototype.block_transactions = function(block, params, cb) {
    var self = this;

    self.client.get("/block/" + block + "/transactions", params, function(err, block_txs) {
        cb(err, block_txs);
    });
};

APIClient.prototype.transaction = function(tx, cb) {
    var self = this;

    self.client.get("/transaction/" + tx, null, function(err, tx) {
        cb(err, tx);
    });
};

module.exports = function(options) {
    return new APIClient(options);
};
