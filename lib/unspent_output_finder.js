var _ = require('lodash');
var q = require('q');
var async = require('async');

/**
 * @param bitcoinDataClient
 * @param options
 * @constructor
 */
var UnspentOutputFinder = function (bitcoinDataClient, options) {
    this.defaultSettings = {
        logging: false
    };
    this.settings = _.merge({}, this.defaultSettings, options);
    this.client = bitcoinDataClient;
};

/**
 * get unspent outputs for an array of addresses
 *
 * @param addresses     an array of addresses to find unspent output for
 * @returns {{}}        an object (associative array) of unspent outputs for each address with a spendable balance
 */
UnspentOutputFinder.prototype.getUTXOs = function (addresses, cb) {
    var self = this;
    var results = {};
    //@todo use promises and callback for async stuff
    //var deferred = q.defer();
    //deferred.promise.nodeify(cb);

    _.each(addresses, function (address, index) {
        if (self.settings.logging) {
            console.log("\nchecking address");
        }
        //get the utxos for this address
        var utxos = self.client.getUnspentOutputs(address);

        if (utxos.length > 0) {
            results[address] = utxos;
        }
    });

    return results;
    //return deferred.promise;
};

module.exports = UnspentOutputFinder;
