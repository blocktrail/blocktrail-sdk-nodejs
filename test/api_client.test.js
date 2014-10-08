var BlockTrail = require('blocktrail-sdk');
var assert = require('assert');

/**
 * @type APIClient
 */
var client = BlockTrail({
    apiKey : "MYKEY",
    apiSecret : "MYSECRET"
});

module.exports = {
    'test auth failure': function(cb) {
        var client = BlockTrail({
            apiKey : "TESTKEY-FAIL",
            apiSecret : "TESTSECRET-FAIL"
        });

        client.address("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", function(err, address) {
            assert.ok(err);

            cb();
        });
    },
    'test address': function(cb) {
        client.address("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", function(err, address) {
            assert.ifError(err);
            assert.ok(address['address']);
            assert.equal(address['address'], '1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp');

            cb();
        });
    },
    'test address_transactions': function(cb) {
        client.address_transactions("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", {limit: 23}, function(err, address_txs) {
            assert.ifError(err);
            assert.ok(address_txs['data']);
            assert.ok(address_txs['total']);
            assert.ok(address_txs['data'].length == 23);

            cb();
        });
    },
    'test address_unconfirmed_transactions': function(cb) {
        client.address_unconfirmed_transactions("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", {limit: 23}, function(err, address_txs) {
            assert.ifError(err);
            assert.ok(address_txs['data']);
            assert.ok(address_txs['total']);
            assert.ok(address_txs['total'] >= address_txs['data'].length);

            cb();
        });
    },
    'test address_unspent_outputs': function(cb) {
        client.address_unspent_outputs("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", {limit: 23}, function(err, address_utxo) {
            assert.ifError(err);
            assert.ok(address_utxo['data']);
            assert.ok(address_utxo['total']);
            assert.ok(address_utxo['total'] >= address_utxo['data'].length);

            cb();
        });
    },
    'test verify_address': function(cb) {
        client.verify_address("16dwJmR4mX5RguGrocMfN9Q9FR2kZcLw2z", "HPMOHRgPSMKdXrU6AqQs/i9S7alOakkHsJiqLGmInt05Cxj6b/WhS7kJxbIQxKmDW08YKzoFnbVZIoTI2qofEzk=", function(err, result) {
            assert.ifError(err);
            assert.ok(result);

            cb();
        });
    },
    'test block by hash': function(cb) {
        client.block("000000000000034a7dedef4a161fa058a2d67a173a90155f3a2fe6fc132e0ebf", function(err, block) {
            assert.ifError(err);
            assert.ok(block['hash']);
            assert.equal(block['hash'], '000000000000034a7dedef4a161fa058a2d67a173a90155f3a2fe6fc132e0ebf');

            cb();
        });
    },
    'test block by height': function(cb) {
        client.block(200000, function(err, block) {
            assert.ifError(err);
            assert.ok(block['hash']);
            assert.equal(block['hash'], '000000000000034a7dedef4a161fa058a2d67a173a90155f3a2fe6fc132e0ebf');

            cb();
        });
    },
    'test block_transactions': function(cb) {
        client.block_transactions("000000000000034a7dedef4a161fa058a2d67a173a90155f3a2fe6fc132e0ebf", {limit: 23}, function(err, block_txs) {
            assert.ifError(err);
            assert.ok(block_txs['data']);
            assert.ok(block_txs['total']);
            assert.ok(block_txs['data'].length == 23);

            cb();
        });
    },
    'test all_blocks': function(cb) {
        client.all_blocks({page:2, limit: 23, sort_dir: 'asc'}, function(err, blocks) {
            assert.ifError(err);
            assert.ok(blocks['data']);
            assert.ok(blocks['total']);
            assert.ok(blocks['data'].length == 23);
            assert.equal(blocks['data'][0]['hash'], '000000000cd339982e556dfffa9de94744a4135c53eeef15b7bcc9bdeb9c2182');
            assert.equal(blocks['data'][1]['hash'], '00000000fc051fbbce89a487e811a5d4319d209785ea4f4b27fc83770d1e415f');

            cb();
        });
    },
    'test block_latest': function(cb) {
        client.block_latest(function(err, block) {
            assert.ifError(err);
            assert.ok(block['hash']);

            cb();
        });
    },
    'test coinbase transaction': function(cb) {
        client.transaction("4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b", function(err, tx) {
            assert.ifError(err);
            assert.equal(tx['hash'], "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b");
            assert.equal(tx['enough_fee'], null);

            cb();
        });
    },
    'test random transaction #1': function(cb) {
        client.transaction("c791b82ed9af681b73eadb7a05b67294c1c3003e52d01e03775bfb79d4ac58d1", function(err, tx) {
            assert.ifError(err);
            assert.equal(tx['hash'], "c791b82ed9af681b73eadb7a05b67294c1c3003e52d01e03775bfb79d4ac58d1");
            assert.ok(tx['confirmations']);
            assert.equal(tx['enough_fee'], true);
            assert.equal(tx['high_priority'], false);

            cb();
        });
    }
}