var blocktrailSDK = require('../api_client');
var _ = require('lodash');
var q = require('q');
var async = require('async');

/**
 *
 * @param options
 * @constructor
 */
var BlocktrailBitcoinService = function (options) {
    this.defaultSettings = {
        apiKey:      null,
        apiSecret:   null,
        network:     'BTC',
        testnet:     false,
        apiVersion:  'v1',
        apiEndpoint: null,

        retryLimit: 5,
        retryDelay:  20,
        paginationLimit: 200
    };
    this.settings = _.merge({}, this.defaultSettings, options);
    //normalise the network settings
    var networkSettings = this.normaliseNetwork(this.settings.network, this.settings.testnet);
    this.settings.network = networkSettings.network;
    this.settings.testnet = networkSettings.testnet;

    this.client = new blocktrailSDK(this.settings);
};

BlocktrailBitcoinService.prototype.normaliseNetwork =  function(network, testnet) {
    switch (network.toLowerCase()) {
        case 'btc':
        case 'bitcoin':
            if (testnet) {
                return {network: "BTC", testnet: true};
            } else {
                return {network: "BTC", testnet: false};
            }
        case 'tbtc':
        case 'bitcoin-testnet':
            return {network: "BTC", testnet: true};
        default:
            throw new Error("Unknown network " + network);
    }
};

BlocktrailBitcoinService.prototype.setPaginationLimit = function(limit) {
    this.settings.paginationLimit = limit;
};

/**
 * gets unspent outputs for an address, returning and array of outputs with hash, index, value, and script pub hex
 *
 * @param address
 * @returns {q.Promise}     promise resolves with array of unspent outputs as [{'hash' => hash, 'index' => index, 'value' => value, 'script_hex' => scriptHex}]
 */
BlocktrailBitcoinService.prototype.getUnspentOutputs = function (address, cb) {
    var self = this;
    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    var page = 1;
    var results = null;
    var utxos = [];
    var retries = 0;

    //get unspent outputs for the address - required data: hash, index, value, and script hex,
    async.doWhilst(function(done) {
        //do
        var params = {
            page: page,
            limit: self.settings.paginationLimit
        };
        self.client.addressUnspentOutputs(address, params).then(function(result) {
            results = result;
            utxos = utxos.concat(results['data']);
            page++;
            done();
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
            done(err);  //nocommit
        });
    }, function() {
        //while
        return results && results['data'].length > 0;
    }, function(err) {
        //all done
        if(err) {
            console.log("complete, but with errors", err.message);
        }

        //reduce the returned data into the values we're interested in
        var result = _.map(utxos, function (utxo, index) {
            return {
                'hash': utxo['hash'],
                'index': utxo['index'],
                'value': utxo['value'],
                'script_hex': utxo['script_hex']
            };
        });
        deferred.resolve(result);
    });

    return deferred.promise;
};

module.exports = BlocktrailBitcoinService;
