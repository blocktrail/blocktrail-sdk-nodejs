/* jshint -W101, -W098 */
var blocktrail = require('../');
var assert = require('assert');

/**
 * @type APIClient
 */
var client = blocktrail.BlocktrailSDK({
    apiKey: process.env.BLOCKTRAIL_SDK_APIKEY || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APIKEY",
    apiSecret: process.env.BLOCKTRAIL_SDK_APISECRET || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APISECRET",
    btccom: typeof process.env.BLOCKTRAIL_SDK_BTCCOM !== "undefined" ? JSON.parse(process.env.BLOCKTRAIL_SDK_BTCCOM) : true
});

describe("using promises", function() {
    it('test block by hash', function(cb) {
        client.block("000000000000034a7dedef4a161fa058a2d67a173a90155f3a2fe6fc132e0ebf").then(function(block) {
            assert.ok(block['hash']);
            assert.equal(block['hash'], '000000000000034a7dedef4a161fa058a2d67a173a90155f3a2fe6fc132e0ebf');

            cb();
        })
        .done();
    });

    it ("should work for address request", function(cb) {
        client.address("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp").then(function(address) {
            assert.ok(address['address']);
            assert.equal(address['address'], '1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp');

            cb();
        })
        .done();
    });
});
