var RestClient = require('./rest_client');

/**
 * Bindings to consume the BlockTrail API
 *
 * @param options       object{
 *                          apiKey: 'API_KEY',
 *                          apiSecret: 'API_SECRET',
 *                          host: 'defaults to api.blocktrail.com',
 *                          network: 'BTC|LTC',
 *                          testnet: true|false
 *                      }
 * @constructor
 */
var APIClient = function (options) {
    var self = this;

    if (typeof(options.https) == "undefined") {
        options.https = true;
    }

    if (!options.host) {
        options.host = 'api.blocktrail.com';
    }

    if (!options.endpoint) {
        options.endpoint = "/" + (options.apiVersion || "v1") + "/" + (options.testnet ? "t" : "") + (options.network || 'BTC').toUpperCase();
    }

    /**
     * @type RestClient
     */
    self.client = RestClient(options);
};

/**
 * get a single address
 *
 * @param address      string  address hash
 * @param cb
 * @return q.Promise
 */
APIClient.prototype.address = function(address, cb) {
    var self = this;

    return self.client.get("/address/" + address, null, cb);
};

/**
 * get all transactions for an address (paginated)
 *
 * @param address       string  address hash
 * @param params        array   pagination: {page: 1, limit: 20, sort_dir: 'asc'}
 * @param cb
 * @return q.Promise
 */
APIClient.prototype.addressTransactions = function(address, params, cb) {
    var self = this;

    return self.client.get("/address/" + address + "/transactions", params, cb);
};

/**
 * get all unconfirmed transactions for an address (paginated)
 *
 * @param address       string  address hash
 * @param params        array   pagination: {page: 1, limit: 20, sort_dir: 'asc'}
 * @param cb
 * @return q.Promise
 */
APIClient.prototype.addressUnconfirmedTransactions = function(address, params, cb) {
    var self = this;

    return self.client.get("/address/" + address + "/unconfirmed-transactions", params, cb);
};

/**
 * get all inspent outputs for an address (paginated)
 *
 * @param address       string  address hash
 * @param params        array   pagination: {page: 1, limit: 20, sort_dir: 'asc'}
 * @param cb
 * @return q.Promise
 */
APIClient.prototype.addressUnspentOutputs = function(address, params, cb) {
    var self = this;

    return self.client.get("/address/" + address + "/unspent-outputs", params, cb);
};

/**
 * verify ownership of an address
 *
 * @param address       string  address hash
 * @param signature     string  a signed message (the address hash) using the private key of the address
 * @param cb
 * @return q.Promise
 */
APIClient.prototype.verifyAddress = function(address, signature, cb) {
    var self = this;

    return self.client.post("/address/" + address + "/verify", null, {signature: signature}, cb);
};

/**
 * get all blocks (paginated)
 *
 * @param params        array   pagination: {page: 1, limit: 20, sort_dir: 'asc'}
 * @param cb
 * @return q.Promise
 */
APIClient.prototype.allBlocks = function(params, cb) {
    var self = this;

    return self.client.get("/all-blocks", params, cb);
};

/**
 * get a block
 *
 * @param block         string|int  a block hash or a block height
 * @param cb
 * @return q.Promise
 */
APIClient.prototype.block = function(block, cb) {
    var self = this;

    return self.client.get("/block/" + block, null, cb);
};

/**
 * get the latest block
 *
 * @param cb
 * @return q.Promise
 */
APIClient.prototype.blockLatest = function(cb) {
    var self = this;

    return self.client.get("/block/latest", null, cb);
};

/**
 * get all transactions for a block (paginated)
 *
 * @param block         string|int  a block hash or a block height
 * @param params        array       pagination: {page: 1, limit: 20, sort_dir: 'asc'}
 * @param cb
 * @return q.Promise
 */
APIClient.prototype.blockTransactions = function(block, params, cb) {
    var self = this;

    return self.client.get("/block/" + block + "/transactions", params, cb);
};

/**
 * get a single transaction
 *
 * @param tx            string      transaction hash
 * @param cb
 * @return q.Promise
 */
APIClient.prototype.transaction = function(tx, cb) {
    var self = this;

    return self.client.get("/transaction/" + tx, null, cb);
};

APIClient.prototype.allWebhooks = function(params, cb) {
    var self = this;

    return self.client.get("/webhooks", params, cb);
};

APIClient.prototype.setupWebhook = function(url, identifier, cb) {
    var self = this;
    if(typeof identifier == "function" && typeof cb == "undefined") {
        //mimic function overloading
        cb = identifier;
        identifier = null;
    }

    return self.client.post("/webhook", null, {url: url, identifier: identifier}, cb);
};

APIClient.prototype.getWebhook = function(identifier, cb) {
    var self = this;

    return self.client.get("/webhook/" + identifier, null, cb);
};

APIClient.prototype.updateWebhook = function(identifier, webhookData, cb) {
    var self = this;

    return self.client.put("/webhook/" + identifier, null, webhookData, cb);
};

APIClient.prototype.deleteWebhook = function(identifier, cb) {
    var self = this;

    return self.client.delete("/webhook/" + identifier, null, cb);
};

APIClient.prototype.getWebhookEvents = function(identifier, params, cb) {
    var self = this;
    if(typeof params == "function" && typeof cb == "undefined") {
        //mimic function overloading
        cb = params;
        params = null;
    }

    return self.client.get("/webhook/" + identifier + "/events", params, cb);
};

APIClient.prototype.subscribeAddressTransactions = function(identifier, address, confirmations, cb) {
    var self = this;
    var postData = {
        'event_type': 'address-transactions',
        'address': address,
        'confirmations': confirmations,
    };

    return self.client.post("/webhook/" + identifier + "/events", null, postData, cb);
};

APIClient.prototype.subscribeNewBlocks = function(identifier, cb) {
    var self = this;
    var postData = {
        'event_type': 'block',
    };

    return self.client.post("/webhook/" + identifier + "/events", null, postData, cb);
};

APIClient.prototype.unsubscribeAddressTransactions = function(identifier, address, cb) {
    var self = this;

    return self.client.delete("/webhook/" + identifier + "/address-transactions/" + address, null, cb);
};

APIClient.prototype.unsubscribeNewBlocks = function(identifier, cb) {
    var self = this;

    return self.client.delete("/webhook/" + identifier + "/block/", null, cb);
};

module.exports = function(options) {
    return new APIClient(options);
};
