/* jshint -W101, -W098 */
var blocktrail = require('../');
var assert = require('assert');

describe('normalizeNetworkFromOptions', function() {
    it("rBTC", function(done) {
        assert.deepEqual(["BTC", true, true, "rBTC"], blocktrail.normalizeNetworkFromOptions({network: 'rBTC'}));
        assert.deepEqual(["BTC", true, true, "rBTC"], blocktrail.normalizeNetworkFromOptions({network: 'rbtc'}));
        assert.deepEqual(["BTC", true, true, "rBTC"], blocktrail.normalizeNetworkFromOptions({network: 'btc', regtest: true}));
        assert.deepEqual(["BTC", true, true, "rBTC"], blocktrail.normalizeNetworkFromOptions({network: 'btc', regtest: true, testnet: true}));
        assert.deepEqual(["BTC", true, true, "rBTC"], blocktrail.normalizeNetworkFromOptions({network: 'rbtc', testnet: true}));

        done();
    });
    it("TBTC", function(done) {
        assert.deepEqual(["BTC", true, false, "tBTC"], blocktrail.normalizeNetworkFromOptions({network: 'tBTC'}));
        assert.deepEqual(["BTC", true, false, "tBTC"], blocktrail.normalizeNetworkFromOptions({network: 'tbtc'}));
        assert.deepEqual(["BTC", true, false, "tBTC"], blocktrail.normalizeNetworkFromOptions({network: 'btc', testnet: true}));

        done();
    });
    it("rBCC", function(done) {
        assert.deepEqual(["BCC", true, true, "rBCC"], blocktrail.normalizeNetworkFromOptions({network: 'rBCH'}));
        assert.deepEqual(["BCC", true, true, "rBCC"], blocktrail.normalizeNetworkFromOptions({network: 'rbch'}));
        assert.deepEqual(["BCC", true, true, "rBCC"], blocktrail.normalizeNetworkFromOptions({network: 'bch', regtest: true}));
        assert.deepEqual(["BCC", true, true, "rBCC"], blocktrail.normalizeNetworkFromOptions({network: 'bch', regtest: true, testnet: true}));
        assert.deepEqual(["BCC", true, true, "rBCC"], blocktrail.normalizeNetworkFromOptions({network: 'rbch', testnet: true}));

        done();
    });
    it("BTC", function(done) {
        assert.deepEqual(["BTC", false, false, "BTC"], blocktrail.normalizeNetworkFromOptions({network: 'BTC'}));
        assert.deepEqual(["BTC", false, false, "BTC"], blocktrail.normalizeNetworkFromOptions({network: 'btc'}));
        assert.deepEqual(["BTC", false, false, "BTC"], blocktrail.normalizeNetworkFromOptions({}));

        done();
    });
    it("BCC", function(done) {
        assert.deepEqual(["BCC", false, false, "BCC"], blocktrail.normalizeNetworkFromOptions({network: 'BCC'}));
        assert.deepEqual(["BCC", false, false, "BCC"], blocktrail.normalizeNetworkFromOptions({network: 'bcc'}));

        done();
    });
});
