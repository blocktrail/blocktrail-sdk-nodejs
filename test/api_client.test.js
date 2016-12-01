/* jshint -W101, -W098 */
var blocktrail = require('../');
var assert = require('assert');
var crypto = require('crypto');

/**
 * @type APIClient
 */
var client = blocktrail.BlocktrailSDK({
    apiKey : process.env.BLOCKTRAIL_SDK_APIKEY || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APIKEY",
    apiSecret : process.env.BLOCKTRAIL_SDK_APISECRET || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APISECRET"
});

describe('SDK general', function() {
    it('test Coin Value', function(cb) {
        assert.equal(blocktrail.toSatoshi(0.00000001), 1);
        assert.equal(blocktrail.toBTC(100000000), 1.0);

        assert.equal(blocktrail.toSatoshi(1.23456789), 123456789);
        assert.equal(blocktrail.toBTC(123456789), 1.23456789);

        cb();
    });
    it('test auth failure', function(cb) {
        var client = blocktrail.BlocktrailSDK({
            apiKey: "TESTKEY-FAIL",
            apiSecret: "TESTSECRET-FAIL"
        });

        client.address("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", function(err, address) {
            assert.ok(err);

            cb();
        });
    });
});

describe('data api', function() {
    it('test address', function(cb) {
        client.address("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", function(err, address) {
            assert.ifError(err);
            assert.ok(address['address']);
            assert.equal(address['address'], '1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp');

            cb();
        });
    });
    it('test addressTransactions', function(cb) {
        client.addressTransactions("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", {limit: 23}, function(err, address_txs) {
            assert.ifError(err);
            assert.ok(address_txs['data']);
            assert.ok(address_txs['total']);
            assert.ok(address_txs['data'].length === 23);

            cb();
        });
    });
    it('test addressUnconfirmedTransactions', function(cb) {
        client.addressUnconfirmedTransactions("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", {limit: 23}, function(err, address_txs) {
            assert.ifError(err);
            assert.ok('data' in address_txs);
            assert.ok('total' in address_txs);
            // assert.ok(address_txs['total'] >= address_txs['data'].length);

            cb();
        });
    });
    it('test addressUnspentOutputs', function(cb) {
        client.addressUnspentOutputs("1DarkStrRagcDjWtsPGxkav4WG3poLXzDS", {limit: 23}, function(err, address_utxo) {
            assert.ifError(err);
            assert.ok('data' in address_utxo);
            assert.ok('total' in address_utxo);
            assert.ok(address_utxo['total'] >= address_utxo['data'].length);

            cb();
        });
    });
    it('test batchAddressUnspentOutputs', function(cb) {
        client.batchAddressUnspentOutputs(["1DarkStrRagcDjWtsPGxkav4WG3poLXzDS", "16fVUD4yCuabS153FJGtmLL8tgydsrf6vu"], {limit: 23}, function(err, address_utxo) {
            assert.ifError(err);
            assert.ok('data' in address_utxo);
            assert.ok('total' in address_utxo);
            assert.ok(address_utxo['total'] >= address_utxo['data'].length);
            cb();
        });
    });
    it('test verifyAddress', function(cb) {
        client.verifyAddress("16dwJmR4mX5RguGrocMfN9Q9FR2kZcLw2z", "HPMOHRgPSMKdXrU6AqQs/i9S7alOakkHsJiqLGmInt05Cxj6b/WhS7kJxbIQxKmDW08YKzoFnbVZIoTI2qofEzk=", function(err, result) {
            assert.ifError(err);
            assert.ok(result);

            cb();
        });
    });
    it('test block by hash', function(cb) {
        client.block("000000000000034a7dedef4a161fa058a2d67a173a90155f3a2fe6fc132e0ebf", function(err, block) {
            assert.ifError(err);
            assert.ok(block['hash']);
            assert.equal(block['hash'], '000000000000034a7dedef4a161fa058a2d67a173a90155f3a2fe6fc132e0ebf');

            cb();
        });
    });
    it('test block by height', function(cb) {
        client.block(200000, function(err, block) {
            assert.ifError(err);
            assert.ok(block['hash']);
            assert.equal(block['hash'], '000000000000034a7dedef4a161fa058a2d67a173a90155f3a2fe6fc132e0ebf');

            cb();
        });
    });
    it('test blockTransactions', function(cb) {
        client.blockTransactions("000000000000034a7dedef4a161fa058a2d67a173a90155f3a2fe6fc132e0ebf", {limit: 23}, function(err, block_txs) {
            assert.ifError(err);
            assert.ok(block_txs['data']);
            assert.ok(block_txs['total']);
            assert.ok(block_txs['data'].length === 23);

            cb();
        });
    });
    it('test allBlocks', function(cb) {
        client.allBlocks({page:2, limit: 23, sort_dir: 'asc'}, function(err, blocks) {
            assert.ifError(err);
            assert.ok(blocks['data']);
            assert.ok(blocks['total']);
            assert.ok(blocks['data'].length === 23);
            assert.equal(blocks['data'][0]['hash'], '000000000cd339982e556dfffa9de94744a4135c53eeef15b7bcc9bdeb9c2182');
            assert.equal(blocks['data'][1]['hash'], '00000000fc051fbbce89a487e811a5d4319d209785ea4f4b27fc83770d1e415f');

            cb();
        });
    });
    it('test blockLatest', function(cb) {
        client.blockLatest(function(err, block) {
            assert.ifError(err);
            assert.ok(block['hash']);

            cb();
        });
    });
    it('test coinbase transaction', function(cb) {
        client.transaction("0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098", function(err, tx) {
            assert.ifError(err);
            assert.equal(tx['hash'], "0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098");
            assert.equal(tx['enough_fee'], null);

            cb();
        });
    });
    it('test random transaction #1', function(cb) {
        client.transaction("c791b82ed9af681b73eadb7a05b67294c1c3003e52d01e03775bfb79d4ac58d1", function(err, tx) {
            assert.ifError(err);
            assert.equal(tx['hash'], "c791b82ed9af681b73eadb7a05b67294c1c3003e52d01e03775bfb79d4ac58d1");
            assert.ok(tx['confirmations']);
            assert.equal(tx['enough_fee'], true);
            assert.equal(tx['high_priority'], false);

            cb();
        });
    });
    it('test batch transactions', function(cb) {
        client.transactions([
            "c791b82ed9af681b73eadb7a05b67294c1c3003e52d01e03775bfb79d4ac58d1",
            "0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098",
            "4bbe6feeb50e47e2de5ef6a9d7378363823611dd07d4a5ea1799da9ae6a21665",
            "6c0d3156621051a86b8af3f23dfe211e8a17a01bffe3c2b24cbee65139873c6a",
            "356210d6b8143e23d0cf4d0dae0ac686015a13fe3b2b46b1cc43a71a36c73355",
            "a40d1eee0cec3d963d8df2870bd642bd3fd07163e864aeb90fa5efe9ea91c998",
            "1c7e3c9823baa9bb70b09ed666e8a6b3120b07f84429ed41f05d5504bd58f188",
            "1f0a168f0fceb6e48208b23ffb1ad528acfc11c30ab302d447743f2a0fc5fe80",
            "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" // not found
        ], function(err, txs) {
            assert.ifError(err);

            assert.equal(Object.keys(txs['data']).length, 8);

            var tx1 = txs['data']["c791b82ed9af681b73eadb7a05b67294c1c3003e52d01e03775bfb79d4ac58d1"];
            assert.equal(tx1['hash'], "c791b82ed9af681b73eadb7a05b67294c1c3003e52d01e03775bfb79d4ac58d1");
            assert.ok(tx1['confirmations']);
            assert.equal(tx1['enough_fee'], true);
            assert.equal(tx1['high_priority'], false);

            var tx2 = txs['data']["0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098"];
            assert.equal(tx2['hash'], "0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098");
            assert.equal(tx2['enough_fee'], null);

            var tx8 = txs['data']["1f0a168f0fceb6e48208b23ffb1ad528acfc11c30ab302d447743f2a0fc5fe80"];
            assert.equal(tx8['hash'], "1f0a168f0fceb6e48208b23ffb1ad528acfc11c30ab302d447743f2a0fc5fe80");

            assert.ok(!txs['data']['ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff']);

            cb();
        });
    });
});

describe('webhooks api', function() {
    var createdWebhooks = [];
    var cleanup = function(done) {
        client.allWebhooks({page:1, limit:500}, function(err, response) {
            //delete each webhook
            //var allWebhooks = response.data;
            if (!createdWebhooks.length) {
                done();
            }
            createdWebhooks.forEach(function(identifier) {
                client.deleteWebhook(identifier, function(err, response) {
                    createdWebhooks.splice(identifier, 1);
                    if (createdWebhooks.length === 0) {
                        done();
                    }
                });
            });
        });
    };
    before(function(done) {
        // runs before all tests in this block..cleanup any existing data that could conflict with the tests
        cleanup(done);
    });
    after(function(done) {
        //cleanup after all tests
        cleanup(done);
    });

    //create a custom (yet "random") identifier such to avoid conflicts when running multiple tests simultaneously
    var myIdentifier = crypto.randomBytes(24).toString('hex');

    // test cases
    it('create new webhook with custom identifier', function(done) {
        client.setupWebhook("https://www.blocktrail.com/webhook-test", myIdentifier, function(err, webhook) {
            assert.ifError(err);
            assert.equal(webhook.url, "https://www.blocktrail.com/webhook-test");
            assert.equal(webhook.identifier, myIdentifier);
            createdWebhooks.push(webhook.identifier);
            done();
        });
    });

    it('create new webhook with random identifier', function(done) {
        client.setupWebhook("https://www.blocktrail.com/webhook-test", function(err, webhook) {
            assert.ifError(err);
            assert.equal(webhook.url, "https://www.blocktrail.com/webhook-test");
            assert.ok(webhook.identifier);
            createdWebhooks.push(webhook.identifier);
            done();
        });
    });

    it('get all user webhooks', function(done) {
        client.allWebhooks(null, function(err, response) {
            assert.ifError(err);
            assert.ok('data' in response, "'data' key not in response");
            assert.ok('total' in response, "'total' key not in response");
            assert.ok(parseInt(response['total']) >= 2, "'total' does not match expected value");
            assert.ok(response['data'].length >= 2, "Count of webhooks returned is not equal to 2");

            assert.ok('url' in response['data'][0], "'url' key not in first webhook of response");
            assert.ok('url' in response['data'][1], "'url' key not in second webhook of response");
            done();
        });
    });

    it('get a single webhook', function(done) {
        client.getWebhook(createdWebhooks[0], function(err, response) {
            assert.ifError(err);
            assert.ok('url' in response, "'url' key not in response");
            assert.ok('identifier' in response, "'identifier' key not in response");
            assert.equal(response['url'], "https://www.blocktrail.com/webhook-test", "'url' does not match expected value");
            assert.equal(response['identifier'], myIdentifier, "'identifier' does not match expected value");
            done();
        });
    });

    it('delete a webhook', function(done) {
        client.deleteWebhook(createdWebhooks[0], function(err, response) {
            assert.ifError(err);
            assert.ok(response);
            done();
        });
    });

    it('update a webhook', function(done) {
        var newIdentifier = crypto.randomBytes(24).toString('hex');
        var newUrl = "https://www.blocktrail.com/new-webhook-url";
        client.updateWebhook(createdWebhooks[1], {identifier: newIdentifier, url: newUrl}, function(err, response) {
            assert.ifError(err);
            assert.ok('url' in response, "'url' key not in response");
            assert.ok('identifier' in response, "'identifier' key not in response");
            assert.equal(response['url'], newUrl, "'url' does not match expected value");
            assert.equal(response['identifier'], newIdentifier, "'identifier' does not match expected value");

            createdWebhooks[1] = newIdentifier;
            done();
        });
    });

    it('subscribe to address-transaction events', function(done) {
        var address = "1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp";
        client.subscribeAddressTransactions(createdWebhooks[1], address, 2, function(err, response) {
            assert.ifError(err);
            assert.ok('event_type' in response, "'event_type' key not in response");
            assert.ok('address' in response, "'address' key not in response");
            assert.ok('confirmations' in response, "'confirmations' key not in response");
            assert.equal(response['event_type'], "address-transactions", "'event_type' does not match expected value");
            assert.equal(response['address'], address, "'address' does not match expected value");
            assert.equal(response['confirmations'], 2, "'confirmations' does not match expected value");
            done();
        });
    });

    it('subscribe to transaction event', function(done) {
        var transaction = "a0a87b1577d606b349cfded85c842bdc53b99bcd49614229a71804b46b1c27cc";
        client.subscribeTransaction(createdWebhooks[1], transaction, 2, function(err, response) {
            assert.ifError(err);
            assert.ok('event_type' in response, "'event_type' key not in response");
            assert.ok('address' in response, "'address' key not in response");
            assert.ok('confirmations' in response, "'confirmations' key not in response");
            assert.equal(response['event_type'], "transaction", "'event_type' does not match expected value");
            assert.equal(response['transaction'], transaction, "'transaction' does not match expected value");
            assert.equal(response['confirmations'], 2, "'confirmations' does not match expected value");
            done();
        });
    });

    it('subscribe to new block events', function(done) {
        client.subscribeNewBlocks(createdWebhooks[1], function(err, response) {
            assert.ifError(err);
            assert.ok('event_type' in response, "'event_type' key not in response");
            assert.ok('address' in response, "'address' key not in response");
            assert.ok('confirmations' in response, "'confirmations' key not in response");
            assert.equal(response['event_type'], "block", "'event_type' does not match expected value");
            assert.equal(response['address'], null, "'address' does not match expected value");
            assert.equal(response['confirmations'], null, "'confirmations' does not match expected value");
            done();
        });
    });

    it('batch subscribe to address-transaction events', function(done) {
        var batchData = [
            {
                'event_type': 'address-transactions',
                'address': '18FA8Tn54Hu8fjn7kkfAygPoGEJLHMbHzo',
                'confirmations': 1
            },
            {
                'address': '1LUCKYwD6V9JHVXAFEEjyQSD4Dj5GLXmte',
                'confirmations': 1
            },
            {
                'address': '1qMBuZnrmGoAc2MWyTnSgoLuWReDHNYyF'
            }
        ];
        client.batchSubscribeAddressTransactions(createdWebhooks[1], batchData, function(err, response) {
            assert.ifError(err);
            assert.ok(response);
            done();
        });
    });

    it('get webhook event subscriptions', function(done) {
        client.getWebhookEvents(createdWebhooks[1], function(err, response) {
            assert.ifError(err);
            assert.ok('data' in response, "'data' key not in response");
            assert.ok('total' in response, "'total' key not in response");
            assert.equal(parseInt(response['total']), 6, "'total' does not match expected value");
            assert.equal(response['data'].length, 6, "Count of event subscriptions returned is not equal to 2");

            assert.ok('event_type' in response['data'][0], "'event_type' key not in first event subscription of response");

            done();
        });
    });

    it('unsubscribe from address-transaction events', function(done) {
        var address = "1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp";
        client.unsubscribeAddressTransactions(createdWebhooks[1], address, function(err, response) {
            assert.ifError(err);
            assert.ok(response);
            done();
        });
    });

    it('unsubscribe from new transaction events', function(done) {
        var transaction = "a0a87b1577d606b349cfded85c842bdc53b99bcd49614229a71804b46b1c27cc";
        client.unsubscribeTransaction(createdWebhooks[1], transaction, function(err, response) {
            assert.ifError(err);
            assert.ok(response);
            done();
        });
    });

    it('unsubscribe from new block events', function(done) {
        client.unsubscribeNewBlocks(createdWebhooks[1], function(err, response) {
            assert.ifError(err);
            assert.ok(response);
            done();
        });
    });
});

describe('market api', function() {
    it('should have a price', function(done) {
        client.price(function(err, price) {
            assert.ifError(err);
            assert.ok(price);
            assert.ok(price['USD']);
            done();
        });
    });
});

describe('verify message', function() {
    var address = "1F26pNMrywyZJdr22jErtKcjF8R3Ttt55G";
    var message = address;
    var signature = "H85WKpqtNZDrajOnYDgUY+abh0KCAcOsAIOQwx2PftAbLEPRA7mzXA/CjXRxzz0MC225pR/hx02Vf2Ag2x33kU4=";

    it('should verify using bitcoinjs-lib', function(done) {
        client.verifyMessage(message, address, signature, function(err, result) {
            assert.ifError(err);
            assert.ok(result);
            done();
        });
    });

    it('should handle errors nicely', function(done) {
        signature = "rubensayshi";
        client.verifyMessage(message, address, signature, function(err, result) {
            assert.ok(err);
            done();
        });
    });

    it('should verify using API', function(done) {
        client.client.post("/verify_message", null, {message: message, address: address, signature: signature}, function(err, result) {
            assert.ifError(err);
            assert.ok(result);
            done();
        });
    });
});

describe('send raw', function() {
    /**
     * @type APIClient
     */
    var client = blocktrail.BlocktrailSDK({
        apiKey : process.env.BLOCKTRAIL_SDK_APIKEY || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APIKEY",
        apiSecret : process.env.BLOCKTRAIL_SDK_APISECRET || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APISECRET",
        testnet : true
    });

    var tx = "0100000001bee92b36d3092e492e858d1199e46b942b3bddcc4c98071f0d307acced6f7751000000006b48304502210087831790820bf8218dc8df38758660a6f1f54a54d5d45ab0c3384e5ace9253ad0220650bce47447094148d45ec5b9ce4e3008e00723f4de6edd677110b2ebf0ff3da012102d8aa27d34020a6eb06e424787dbbb60f2cf4250a5a1110ab9e15e68fe710abc5ffffffff0131244c00000000001976a914a8d7a8e6724cf3f8ffb92c376ecb0094c18cbaf588ac00000000";

    // note that -27 (already in blockchain) is only when it's unspent
    it("should report TX is already in blockchain", function(done) {
        client.sendRawTransaction(tx, function(err, result) {
            assert.ok(err);
            assert.ok(result.code === -27 || result.code === -25);

            done();
        });
    });

    it('should error decode failed', function(done) {
        client.sendRawTransaction(tx.substr(-2), function(err, result) {
            assert.ok(err);
            assert.equal(-22, result.code);

            done();
        });
    });
});
