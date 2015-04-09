var blocktrailSDK = require('../api_client');
var _ = require('lodash');

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
        sleepTime:  20,
        paginationLimit: 500
    };
    this.settings = _.merge({}, this.defaultSettings, options);

    this.paginationLimit = 500;
    this.retryLimit = 5;
    this.sleepTime =  20;
    this.retries = 0;
    this.client = new blocktrailSDK(this.settings);
};

BlocktrailBitcoinService.prototype.setPaginationLimit = function(limit) {
    this.settings.paginationLimit = limit;
};

/**
 * gets unspent outputs for an address, returning and array of outputs with hash, index, value, and script pub hex
 *
 * @param address
 * @returns {*}      array of unspent outputs as [{'hash' => hash, 'index' => index, 'value' => value, 'script_hex' => scriptHex}]
 */
BlocktrailBitcoinService.prototype.getUnspentOutputs = function (address, callback) {
    var self = this;

    //get unspent outputs for the address - required data: hash, index, value, and script hex
    var utxos = [];
    try {
        var page = 1;
        do {
            var results = self.client.addressUnspentOutputs(address, page, self.settings.paginationLimit);
            utxos = utxos.concat(results['data']);
            page++;
        } while (results['data'].length > 0);

    } catch (error) {
        //if rate limit is getting hit, try again after a short while
        if (self.settings.retries < self.settings.retryLimit) {
            self.settings.retries++;
            setTimeout(function() {
                self.getUnspentOutputs(address);
            }, self.settings.sleepTime);

            return self.getUnspentOutputs(address);
        } else {
            throw error;
        }
    }

    //reset retry count
    self.retries = 0;

    //reduce the returned data into the values we're interested in
    /*
    var result = array_map(function (utxo) {
        return array(
            'hash'       => utxo['hash'],
            'index'      => utxo['index'],
            'value'      => utxo['value'],
            'script_hex' => utxo['script_hex'],
        );
    }, utxos);
    */

    return result;


};

module.exports = BlocktrailBitcoinService;
