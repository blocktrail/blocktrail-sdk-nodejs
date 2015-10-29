var blocktrail = require('../blocktrail');
var Request = require('../request');
var _ = require('lodash');
var q = require('q');
var async = require('async');

/**
 *
 * @param options
 * @constructor
 */
var InsightBitcoinService = function (options) {
    this.defaultSettings = {
        testnet:    false,

        retryLimit: 5,
        retryDelay:  20
    };
    this.settings = _.merge({}, this.defaultSettings, options);

    var httpOptions = {
        https: true,
        host: '',
        port: '',
        endpoint: (this.settings.testnet ? 'test-' : '') + 'insight.bitpay.com/api/'
    };
    this.client = new Request(httpOptions);
};

/**
 * gets unspent outputs for an address, returning an array of outputs with hash, index, value, and script pub hex
 *
 * @param address
 * @returns {q.Promise}     promise resolves with array of unspent outputs as [{"hash": hash, "index": index, "value": value, "script_hex": scriptHex}]
 */
InsightBitcoinService.prototype.getUnspentOutputs = function (address, cb) {
    throw new Error('unsupported: use getBatchUnspentOutputs instead');
};

/**
 * gets unspent outputs for a batch of addresses, returning an array of outputs with hash, index, value, and script pub hex mapped to each corresponding address
 *
 * @param {array} addresses   array of addresses
 * @returns {q.Promise}     promise resolves with array of unspent outputs mapped to addresses as { address: [{"hash": hash, "index": index, "value": value, "script_hex": scriptHex}]}
 */
InsightBitcoinService.prototype.getBatchUnspentOutputs = function (addresses, cb) {
    var self = this;
    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    var batchResults = {};  //utxos mapped to addresses
    var utxos = [];
    var retries = 0;

    //get unspent outputs for the chunk of addresses - required data: hash, index, value, and script hex,
    var params = {};
    var data = {"addrs": addresses.join(',')};
    self.client.request('POST', 'addrs/utxo', params, data).then(function(results) {

        //reduce the returned data into the values we're interested in, and map to the relevant addresses
        results.forEach(function(utxo, index) {
            var address = utxo['address'];

            if (typeof batchResults[address] == "undefined") {
                batchResults[address] = [];
            }

            batchResults[address].push({
                'hash': utxo['txid'],
                'index': utxo['vout'],
                'value': blocktrail.toSatoshi(utxo['amount']),
                'script_hex': utxo['scriptPubKey']
            });
        });
        deferred.resolve(batchResults);

    }, function(err) {
        console.log('error happened:', err);
        //error encountered, keep retrying until the retry limit has passed
        //use a short delay to help tackle rate limiting
        /*
         if (retries < self.settings.retryLimit) {
         retries++;
         //@todo
         setTimeout(function() {
         self.getUnspentOutputs(address);
         }, self.settings.retryDelay);

         return self.getUnspentOutputs(address);
         } else {
         done(err);
         }
         */
    });


    return deferred.promise;
};

module.exports = InsightBitcoinService;
