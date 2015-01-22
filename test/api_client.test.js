var blocktrail = require('blocktrail-sdk');
var assert = require('assert');
var crypto = require('crypto');

/**
 * @type APIClient
 */
var client = blocktrail({
    apiKey : "MY_APIKEY",
    apiSecret : "MY_APISECRET"
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
        var client = blocktrail({
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
            assert.ok(address_txs['data'].length == 23);

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
        client.addressUnspentOutputs("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", {limit: 23}, function(err, address_utxo) {
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
            assert.ok(block_txs['data'].length == 23);

            cb();
        });
    });
    it('test allBlocks', function(cb) {
        client.allBlocks({page:2, limit: 23, sort_dir: 'asc'}, function(err, blocks) {
            assert.ifError(err);
            assert.ok(blocks['data']);
            assert.ok(blocks['total']);
            assert.ok(blocks['data'].length == 23);
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
        client.transaction("4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b", function(err, tx) {
            assert.ifError(err);
            assert.equal(tx['hash'], "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b");
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
});

describe('webhooks api', function() {
    var createdWebhooks = [];
    var cleanup = function(done){
        client.allWebhooks({page:1, limit:500}, function(err, response){
            //delete each webhook
            //var allWebhooks = response.data;
            if(!createdWebhooks.length) {
                done();
            }
            createdWebhooks.forEach(function(identifier){
                client.deleteWebhook(identifier, function(err, response){
                    createdWebhooks.splice(identifier, 1);
                    if(createdWebhooks.length==0) {
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
    after(function(done){
        //cleanup after all tests
        cleanup(done);
    });

    //create a custom (yet "random") identifier such to avoid conflicts when running multiple tests simultaneously
    var myIdentifier = crypto.randomBytes(24).toString('hex');

    // test cases
    it('create new webhook with custom identifier', function(done){
        client.setupWebhook("https://www.blocktrail.com/webhook-test", myIdentifier, function(err, webhook) {
            assert.ifError(err);
            assert.equal(webhook.url, "https://www.blocktrail.com/webhook-test");
            assert.equal(webhook.identifier, myIdentifier);
            createdWebhooks.push(webhook.identifier);
            done();
        });
    });

    it('create new webhook with random identifier', function(done){
        client.setupWebhook("https://www.blocktrail.com/webhook-test", function(err, webhook) {
            assert.ifError(err);
            assert.equal(webhook.url, "https://www.blocktrail.com/webhook-test");
            assert.ok(webhook.identifier);
            createdWebhooks.push(webhook.identifier);
            done();
        });
    });

    it('get all user webhooks', function(done){
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

    it('get a single webhook', function(done){
        client.getWebhook(createdWebhooks[0], function(err, response) {
            assert.ifError(err);
            assert.ok('url' in response, "'url' key not in response");
            assert.ok('identifier' in response, "'identifier' key not in response");
            assert.equal(response['url'], "https://www.blocktrail.com/webhook-test", "'url' does not match expected value");
            assert.equal(response['identifier'], myIdentifier, "'identifier' does not match expected value");
            done();
        });
    });

    it('delete a webhook', function(done){
        client.deleteWebhook(createdWebhooks[0], function(err, response) {
            assert.ifError(err);
            assert.ok(response);
            done();
        });
    });

    it('update a webhook', function(done){
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

    it('subscribe to address-transaction events', function(done){
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

    it('subscribe to new block events', function(done){
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

    it('batch subscribe to address-transaction events', function(done){
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

    it('get webhook event subscriptions', function(done){
        client.getWebhookEvents(createdWebhooks[1], function(err, response) {
            assert.ifError(err);
            assert.ok('data' in response, "'data' key not in response");
            assert.ok('total' in response, "'total' key not in response");
            assert.equal(parseInt(response['total']), 5, "'total' does not match expected value");
            assert.equal(response['data'].length, 5, "Count of event subscriptions returned is not equal to 2");

            assert.ok('event_type' in response['data'][0], "'event_type' key not in first event subscription of response");
            assert.ok('event_type' in response['data'][1], "'event_type' key not in second event subscription of response");
            /*
            //following are unreliable as order can change
            assert.equal(response['data'][0]['event_type'], "address-transactions", "First event subscription event type does not match expected value");
            assert.equal(response['data'][1]['event_type'], "block", "Second event subscription event type does not match expected value");
            assert.equal(response['data'][2]['address'], "18FA8Tn54Hu8fjn7kkfAygPoGEJLHMbHzo", "Third event subscription address does not match expected value");
            */
            done();
        });
    });

    it('unsubscribe from address-transaction events', function(done){
        var address = "1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp";
        client.unsubscribeAddressTransactions(createdWebhooks[1], address, function(err, response) {
            assert.ifError(err);
            assert.ok(response);
            done();
        });
    });

    it('unsubscribe from new block events', function(done){
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
