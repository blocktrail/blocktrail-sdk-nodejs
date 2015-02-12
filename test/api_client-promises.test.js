var blocktrail = require('../');
var assert = require('assert');

/**
 * @type APIClient
 */
var client = blocktrail.BlocktrailSDK({
    apiKey : process.env.BLOCKTRAIL_SDK_APIKEY || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APIKEY",
    apiSecret : process.env.BLOCKTRAIL_SDK_APISECRET || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APISECRET"
});

module.exports = {
    'test address': function(cb) {
        client.address("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp").then(function(address) {
            assert.ok(address['address']);
            assert.equal(address['address'], '1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp');

            cb();
        })
        .done();
    },
    'test verifyAddress': function(cb) {
        client.verifyAddress("16dwJmR4mX5RguGrocMfN9Q9FR2kZcLw2z", "HPMOHRgPSMKdXrU6AqQs/i9S7alOakkHsJiqLGmInt05Cxj6b/WhS7kJxbIQxKmDW08YKzoFnbVZIoTI2qofEzk=")
            .then(function(result) {
                assert.ok(result);

                cb();
            })
            .done();
    }
}
