/* jshint -W101, -W098 */
var blocktrail = require('../');
var assert = require('assert');
var crypto = require('crypto');
var q = require('q');

describe('InsightBitcoinService', function() {
    it('defaults to bitpay on mainnet', function(cb) {
        var insight = new blocktrail.InsightBitcoinService({});
        assert.equal(insight.settings.host, insight.DEFAULT_ENDPOINT_MAINNET);
        assert.equal(insight.settings.testnet, false);
        cb();
    });

    it('uses bitpays testnet server if host is not set', function(cb) {
        var insight = new blocktrail.InsightBitcoinService({
            testnet: true
        });
        assert.equal(insight.settings.host, insight.DEFAULT_ENDPOINT_TESTNET);
        assert.equal(insight.settings.testnet, true);
        cb();
    });

    it('uses bitpays testnet server if host is not set', function(cb) {
        var insight = new blocktrail.InsightBitcoinService({
            testnet: true
        });
        assert.equal(insight.settings.host, insight.DEFAULT_ENDPOINT_TESTNET);
        assert.equal(insight.settings.testnet, true);
        cb();
    });

    [true, false].map(function(testnet) {
        var network = testnet ? 'testnet' : 'mainnet';
        var host = 'insight.litecore.io';

        it('ignores testnet option if host is set: ' + network, function(cb) {
            var insight = new blocktrail.InsightBitcoinService({
                host: host,
                testnet: testnet
            });
            assert.equal(insight.settings.host, host);
            assert.equal(insight.settings.testnet, testnet);
            cb();
        });
    });

    [
        ['POST', 'object', function(insight) {
            return insight.getBatchUnspentOutputs(['mpFnXKEomQw8DBxbDfD9PXZuMvXRxVoAEo']);
        }],
        ['GET', 'number', function(insight) {
            return insight.estimateFee();
        }]
    ].map(function(fixture) {
        var method = fixture[0];
        var resultType = fixture[1];
        var fxn = fixture[2];
        it('issues ' + method + ' requests', function(cb) {
            this.timeout(10000);
            var insight = new blocktrail.InsightBitcoinService({
                testnet: true
            });

            var deferred = q.defer();
            fxn(insight)
                .then(function(result) {
                    assert.equal(resultType, typeof result);
                    deferred.resolve(true);
                }, function() {
                    deferred.resolve(false);
                });

            deferred.promise.then(function(result) {
                assert.equal(true, result);
                cb();
            });
        });
    });
});
