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
APIClient.prototype.address_transactions = function(address, params, cb) {
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
APIClient.prototype.address_unconfirmed_transactions = function(address, params, cb) {
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
APIClient.prototype.address_unspent_outputs = function(address, params, cb) {
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
APIClient.prototype.verify_address = function(address, signature, cb) {
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
APIClient.prototype.all_blocks = function(params, cb) {
    var self = this;

    return self.client.get("/all-blocks", params, cb);
};

/**
 * get a block
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
 * @param cb
 * @return q.Promise
 */
APIClient.prototype.block_latest = function(cb) {
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
APIClient.prototype.block_transactions = function(block, params, cb) {
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

module.exports = function(options) {
    return new APIClient(options);
};
