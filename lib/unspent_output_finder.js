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
 * @param addresses         an array of addresses to find unspent output for
 * @returns {q.Promise}     resolves with an object (associative array) of unspent outputs for each address with a spendable balance
 */
UnspentOutputFinder.prototype.getUTXOs = function (addresses, cb) {
    var self = this;
    var results = {};
    //@todo use promises and callback for async stuff
    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    //do one address at a time, to deal with rate limiting better
    async.eachSeries(addresses, function (address, done) {
        if (self.settings.logging) {
            console.log("checking address: "+address);
        }
        //get the utxos for this address
        self.client.getUnspentOutputs(address).done(function(utxos) {
            //add the found utxos to the final result
            if (utxos.length > 0) {
                results[address] = utxos;
            }
            //this iteration is complete
            done();
        }, function(err) {
            done(err);
        });

    }, function(err) {
        //callback
        if (err) {
            //perhaps we should also reject the promise, and stop everything?
            console.log("error encountered", err);
        }

        //resolve the promise
        deferred.resolve(results);
    });

    return deferred.promise;
};

module.exports = UnspentOutputFinder;
