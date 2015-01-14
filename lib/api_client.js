var q = require('q'),
    bitcoin = require('bitcoinjs-lib'),
    bip39 = require("bip39"),
    Wallet = require('./wallet'),
    RestClient = require('./rest_client'),
    blocktrail = require('./blocktrail');

// apply patch to Q to add spreadNodeify
blocktrail.patchQ(q);

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

    // BLOCKTRAIL_SDK_API_ENDPOINT overwrite for de
    if (process.env.BLOCKTRAIL_SDK_API_ENDPOINT) {
        if (process.env.BLOCKTRAIL_SDK_API_ENDPOINT.indexOf("https://") === 0) {
            options.https = true;
            options.host = process.env.BLOCKTRAIL_SDK_API_ENDPOINT.substr(8);
        } else if (process.env.BLOCKTRAIL_SDK_API_ENDPOINT.indexOf("http://") === 0) {
            options.https = false;
            options.host = process.env.BLOCKTRAIL_SDK_API_ENDPOINT.substr(7);
        } else {
            throw new Error("Invalid value for BLOCKTRAIL_SDK_API_ENDPOINT");
        }
    }

    if (typeof(options.https) == "undefined") {
        options.https = true;
    }

    if (!options.host) {
        options.host = 'api.blocktrail.com';
    }

    self.testnet = options.testnet = options.testnet || false;

    if (!options.endpoint) {
        options.endpoint = "/" + (options.apiVersion || "v1") + "/" + (self.testnet ? "t" : "") + (options.network || 'BTC').toUpperCase();
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
 * @param cb            function    callback function to call when request is complete
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
 * @param cb            function    callback function to call when request is complete
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
 * @param cb            function    callback function to call when request is complete
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
 * @param cb            function    callback function to call when request is complete
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
 * @param cb            function    callback function to call when request is complete
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
 * @param cb            function    callback function to call when request is complete
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
 * @param cb            function    callback function to call when request is complete
 * @return q.Promise
 */
APIClient.prototype.block = function(block, cb) {
    var self = this;

    return self.client.get("/block/" + block, null, cb);
};

/**
 * get the latest block
 *
 * @param cb            function    callback function to call when request is complete
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
 * @param params        object      pagination: {page: 1, limit: 20, sort_dir: 'asc'}
 * @param cb            function    callback function to call when request is complete
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
 * @param cb            function    callback function to call when request is complete
 * @return q.Promise
 */
APIClient.prototype.transaction = function(tx, cb) {
    var self = this;

    return self.client.get("/transaction/" + tx, null, cb);
};

/**
 * get a paginated list of all webhooks associated with the api user
 * @param params        object      pagination: {page: 1, limit: 20}
 * @param cb            function    callback function to call when request is complete
 * @return q.Promise
 */
APIClient.prototype.allWebhooks = function(params, cb) {
    var self = this;

    return self.client.get("/webhooks", params, cb);
};

/**
 * create a new webhook
 * @param url           string      the url to receive the webhook events
 * @param identifier    string      a unique identifier associated with the webhook
 * @param cb            function    callback function to call when request is complete
 * @return q.Promise
 */
APIClient.prototype.setupWebhook = function(url, identifier, cb) {
    var self = this;
    if(typeof identifier == "function" && typeof cb == "undefined") {
        //mimic function overloading
        cb = identifier;
        identifier = null;
    }

    return self.client.post("/webhook", null, {url: url, identifier: identifier}, cb);
};

/**
 * get an existing webhook by it's identifier
 * @param identifier    string      the unique identifier of the webhook to get
 * @param cb            function    callback function to call when request is complete
 * @return q.Promise
 */
APIClient.prototype.getWebhook = function(identifier, cb) {
    var self = this;

    return self.client.get("/webhook/" + identifier, null, cb);
};

/**
 * update an existing webhook
 * @param identifier    string      the unique identifier of the webhook
 * @param webhookData   object      the data to update: {identifier: newIdentifier, url:newUrl}
 * @param cb            function    callback function to call when request is complete
 * @return q.Promise
 */
APIClient.prototype.updateWebhook = function(identifier, webhookData, cb) {
    var self = this;

    return self.client.put("/webhook/" + identifier, null, webhookData, cb);
};

/**
 *  deletes an existing webhook and any event subscriptions associated with it
 * @param identifier    string      the unique identifier of the webhook
 * @param cb            function    callback function to call when request is complete
 * @return q.Promise
 */
APIClient.prototype.deleteWebhook = function(identifier, cb) {
    var self = this;

    return self.client.delete("/webhook/" + identifier, null, null, cb);
};

/**
 * get a paginated list of all the events a webhook is subscribed to
 * @param identifier    string      the unique identifier of the webhook
 * @param params        object      pagination: {page: 1, limit: 20}
 * @param cb            function    callback function to call when request is complete
 * @return q.Promise
 */
APIClient.prototype.getWebhookEvents = function(identifier, params, cb) {
    var self = this;
    if(typeof params == "function" && typeof cb == "undefined") {
        //mimic function overloading
        cb = params;
        params = null;
    }

    return self.client.get("/webhook/" + identifier + "/events", params, cb);
};

/**
 * subscribes a webhook to transaction events on a particular address
 * @param identifier    string      the unique identifier of the webhook
 * @param address       string      the address hash
 * @param confirmations integer     the amount of confirmations to send
 * @param cb            function    callback function to call when request is complete
 * @return q.Promise
 */
APIClient.prototype.subscribeAddressTransactions = function(identifier, address, confirmations, cb) {
    var self = this;
    var postData = {
        'event_type': 'address-transactions',
        'address': address,
        'confirmations': confirmations
    };

    return self.client.post("/webhook/" + identifier + "/events", null, postData, cb);
};

/**
 * subscribes a webhook to a new block event
 * @param identifier    string      the unique identifier of the webhook
 * @param cb            function    callback function to call when request is complete
 * @return q.Promise
 */
APIClient.prototype.subscribeNewBlocks = function(identifier, cb) {
    var self = this;
    var postData = {
        'event_type': 'block'
    };

    return self.client.post("/webhook/" + identifier + "/events", null, postData, cb);
};

/**
 * removes an address transaction event subscription from a webhook
 * @param identifier    string      the unique identifier of the webhook
 * @param address       string      the address hash
 * @param cb            function    callback function to call when request is complete
 * @return q.Promise
 */
APIClient.prototype.unsubscribeAddressTransactions = function(identifier, address, cb) {
    var self = this;

    return self.client.delete("/webhook/" + identifier + "/address-transactions/" + address, null, null, cb);
};

/**
 * removes a block event subscription from a webhook
 * @param identifier    string      the unique identifier of the webhook
 * @param cb            function    callback function to call when request is complete
 * @return q.Promise
 */
APIClient.prototype.unsubscribeNewBlocks = function(identifier, cb) {
    var self = this;

    return self.client.delete("/webhook/" + identifier + "/block/", null, null, cb);
};

APIClient.prototype.initWallet = function(identifier, passphrase, cb) {
    var self = this;

    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    self.client.get("/wallet/" + identifier, null, function(err, data) {
        if (err) {
            return deferred.reject(err);
        }

        var primaryPrivateKey = bitcoin.HDNode.fromSeedBuffer(
            bip39.mnemonicToSeed(data.primary_mnemonic, passphrase),
            self.testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin
        );

        var checksum = primaryPrivateKey.getAddress().toBase58Check();

        if (checksum != data.checksum) {
            return deferred.reject(new Error("Checksum [" + checksum + "] does not match [" + data.checksum + "], most likely due to incorrect password"));
        }

        // @TODO: auto upgrade

        var wallet = new Wallet(
            self,
            identifier,
            data.primary_mnemonic,
            primaryPrivateKey,
            data.backup_public_key,
            data.blocktrail_public_keys,
            data.key_index,
            self.testnet
        );

        return deferred.resolve(wallet);
    });

    return deferred.promise;
};

APIClient.prototype.createNewWallet = function(identifier, passphrase, keyIndex, cb) {
    var self = this;

    // keyIndex is optional
    if (typeof keyIndex == "function") {
        cb = keyIndex;
        keyIndex = null;
    }

    var deferred = q.defer();

    deferred.promise.spreadNodeify(cb);

    // default to keyIndex = 0
    keyIndex = keyIndex || 0;

    var primaryMnemonic = bip39.generateMnemonic(512);
    var primaryPrivateKey = bitcoin.HDNode.fromSeedBuffer(
        bip39.mnemonicToSeed(primaryMnemonic, passphrase),
        self.testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin
    );
    var primaryPublicKey = primaryPrivateKey.deriveHardened(keyIndex).neutered();
    primaryPublicKey = [primaryPublicKey.toBase58(), "M/" + keyIndex + "'"];

    var backupMnemonic = bip39.generateMnemonic(512);
    var backupPrivateKey = bitcoin.HDNode.fromSeedBuffer(
        bip39.mnemonicToSeed(backupMnemonic, ""),
        self.testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin
    );
    var backupPublicKey = backupPrivateKey.neutered();
    backupPublicKey = [backupPublicKey.toBase58(), "M"];

    var checksum = primaryPrivateKey.getAddress().toBase58Check();

    self._createNewWallet(identifier, primaryPublicKey, backupPublicKey, primaryMnemonic, checksum, keyIndex, function(err, result) {
        if (err) {
            return deferred.reject(err);
        }
        // @TODO: auto upgrade

        var blocktrailPubKeys = result.blocktrail_public_keys;

        var wallet = new Wallet(
            self,
            identifier,
            primaryMnemonic,
            primaryPrivateKey,
            backupPublicKey,
            blocktrailPubKeys,
            keyIndex,
            self.testnet
        );

        return deferred.resolve([wallet, primaryMnemonic, backupMnemonic, blocktrailPubKeys]);
    });

    return deferred.promise;
};

APIClient.prototype._createNewWallet = function(identifier, primaryPublicKey, backupPublicKey, primaryMnemonic, checksum, keyIndex, cb) {
    var self = this;

    var postData = {
        identifier: identifier,
        primary_public_key: primaryPublicKey,
        backup_public_key: backupPublicKey,
        primary_mnemonic: primaryMnemonic,
        checksum: checksum,
        key_index: keyIndex
    };

    return self.client.post("/wallet", null, postData, cb);
};

APIClient.prototype.getWalletBalance = function(identifier, cb) {
    var self = this;

    return self.client.get("/wallet/" + identifier + "/balance", null, cb);
};

APIClient.prototype.doWalletDiscovery = function(identifier, cb) {
    var self = this;

    return self.client.get("/wallet/" + identifier + "/discovery", null, cb);
};

APIClient.prototype.getNewDerivation = function(identifier, path, cb) {
    var self = this;

    return self.client.post("/wallet/" + identifier + "/path", null, {path: path}, cb);
};

APIClient.prototype.deleteWallet = function(identifier, checksumAddress, checksumSignature, cb) {
    var self = this;

    return self.client.delete("/wallet/" + identifier, null, {
        checksum: checksumAddress,
        signature: checksumSignature
    }, cb);
};

APIClient.prototype.coinSelection = function(identifier, pay, lockUTXO, allowZeroConf, cb) {
    var self = this;

    var deferred = q.defer();
    deferred.promise.spreadNodeify(cb);

    self.client.post("/wallet/" + identifier + "/coin-selection", {lock: lockUTXO, zeroconf: allowZeroConf ? 1 : 0}, pay, function(err, result) {
        if (err) {
            return deferred.reject(err);
        }

        return deferred.resolve([result.utxos, result.fee, result.change]);
    });

    return deferred.promise;

};

APIClient.prototype.sendTransaction = function(identifier, txHex, paths, cb) {
    var self = this;

    return self.client.post("/wallet/" + identifier + "/send", null, {raw_transaction: txHex, paths: paths}, cb);

};

module.exports = function(options) {
    return new APIClient(options);
};
