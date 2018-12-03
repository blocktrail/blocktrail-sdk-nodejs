var blocktrail = require('../blocktrail');
var request = require('superagent');
var _ = require('lodash');
var q = require('q');
var bitcoin = require('bitcoinjs-lib');

/*
This bridge works in conjunction with the open source project:
    https://github.com/btccom/wallet-recovery-data-bridge/

You can run your private instance on your home machine, simply change the
options.host to http://localhost:[portOfBridge]
where [portOfBridge] is the port on which your bridge is running (8080 by default)
 */

/**
 *
 * @param options
 * @constructor
 */
var SPVBridgeBitcoinService = function(options) {
    if (!('host' in options)) {
        throw new Error("provide a fully qualified URL for the server host in options!");
    }

    this.defaultSettings = {
        retryLimit: 5,
        retryDelay: 20
    };

    // Backwards compatibility: change default host to bitpay
    // if host not set but testnet requested.
    this.settings = _.merge({}, this.defaultSettings, options);
};

/**
 * gets unspent outputs for a batch of addresses, returning an array of outputs with hash, index, value,
 * and script pub hex mapped to each corresponding address
 *
 * @param {array} addresses array of addresses
 * @returns {q.Promise}     promise resolves with array of unspent outputs mapped to addresses as
 *                          { address: [{"hash": hash, "index": index, "value": value, "script_hex": scriptHex}]}
 */
SPVBridgeBitcoinService.prototype.getBatchUnspentOutputs = function(addresses) {
    var self = this;
    var deferred = q.defer();

    //get unspent outputs for the chunk of addresses - required data: hash, index, value, and script hex,
    var data = {"address": addresses};
    self.postEndpoint('addressListUnspent', data).then(function(results) {
        var batchResults = {};  //utxos mapped to addresses

        //reduce the returned data into the values we're interested in, and map to the relevant addresses
        results.forEach(function(utxo) {
            var address = utxo['address'];

            if (typeof batchResults[address] === "undefined") {
                batchResults[address] = [];
            }

            batchResults[address].push({
                'hash': utxo['tx_hash'],
                'index': utxo['tx_pos'],
                'value': utxo['value'],
                'script_hex': bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoincash),
                'confirmations': 1 // TODO quickfix
            });
        });
        deferred.resolve(batchResults);

    }, function(err) {
        deferred.reject(err);
    });


    return deferred.promise;
};

/**
 * gets transactions for a batch of addresses
 *
 * @param {array} addresses   array of addresses
 * @returns {q.Promise}
 */
SPVBridgeBitcoinService.prototype.batchAddressHasTransactions = function(addresses) {
    var self = this;

    var data = {"address": addresses};
    return self.postEndpoint('addressHasTransactions', data)
        .then(function(results) {
            return results.length > 0;
        })
        ;
};

/**
 * get estimated fee/kb
 *
 * @returns {q.Promise}
 */
SPVBridgeBitcoinService.prototype.estimateFee = function() {
    var self = this;

    var nBlocks = "4";

    return self.getEndpoint('estimateFeeRate?confirmations=' + nBlocks)
        .then(function(results) {
            if (results[nBlocks] === -1) {
                return 100000;
            }

            return parseInt(results[nBlocks] * 1e8, 10);
        })
    ;
};

/**
 * Submit a raw transaction hex to the tx/send endpoint
 * @param hex
 * @returns {*}
 */
SPVBridgeBitcoinService.prototype.sendTx = function(hex) {
    return this.postEndpoint('publishTx', {tx: hex});
};

/**
 * Makes a URL from the endpoint and issues a GET request.
 * @param endpoint
 */
SPVBridgeBitcoinService.prototype.getEndpoint = function(endpoint) {
    return this.getRequest(this.settings.host + '/' + endpoint);
};

/**
 * Makes URL from endpoint and issues a POST request.
 *
 * @param endpoint
 * @param data
 * @returns {promise|Function|*}
 */
SPVBridgeBitcoinService.prototype.postEndpoint = function(endpoint, data) {
    return this.postRequest(this.settings.host + '/' + endpoint, data);
};

/**
 * Makes a GET request to url
 * @param url
 * @returns {promise|Function|*}
 */
SPVBridgeBitcoinService.prototype.getRequest = function(url) {
    var deferred = q.defer();
    request
        .get(url)
        .end(function(error, res) {
            if (error) {
                deferred.reject(error);
                return;
            }
            if (res.ok) {
                if (res.headers['content-type'].indexOf('application/json') >= 0) {
                    try {
                        var body = JSON.parse(res.text);
                        return deferred.resolve(body);

                    } catch (e) {
                        return deferred.reject(error);
                    }
                } else {
                    return deferred.resolve(res.body);
                }
            } else {
                return deferred.reject(res.text);
            }
        });

    return deferred.promise;
};

/**
 * Makes a POST request given the url and data
 *
 * @param url
 * @param data
 * @returns {promise|Function|*}
 */
SPVBridgeBitcoinService.prototype.postRequest = function(url, data) {
    var deferred = q.defer();

    request
        .post(url)
        .send(data)
        .set('Content-Type', 'application/json')
        .end(function(error, res) {
            if (error) {
                deferred.reject(error);
                return;
            }
            if (res.ok) {
                // Insight server provides valid JSON but doesn't set Content-Type on some responses
                // so we are going to try and parse JSON first, then check the Content-Type and resolve accordingly
                try {
                    var body = JSON.parse(res.text);
                    return deferred.resolve(body);
                } catch (e) {
                    if (res.headers['content-type'].indexOf('application/json') >= 0) {
                        return deferred.reject(error);
                    } else {
                        return deferred.resolve(res.body);
                    }
                }
            } else {
                return deferred.reject(res.text);
            }
        });

    return deferred.promise;
};

module.exports = SPVBridgeBitcoinService;
