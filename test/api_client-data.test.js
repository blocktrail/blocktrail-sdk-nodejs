/* jshint -W101, -W098 */
var blocktrail = require('../');
var assert = require('assert');
var crypto = require('crypto');

/**
 * @type APIClient
 */
var client = blocktrail.BlocktrailSDK({
    apiKey: process.env.BLOCKTRAIL_SDK_APIKEY || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APIKEY",
    apiSecret: process.env.BLOCKTRAIL_SDK_APISECRET || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APISECRET",
    btccom: typeof process.env.BLOCKTRAIL_SDK_BTCCOM !== "undefined" ? JSON.parse(process.env.BLOCKTRAIL_SDK_BTCCOM) : true
});

var cleanTxin = function(txin) {
    delete txin.output_confirmed;
    delete txin.multisig;
    delete txin.multisig_addresses;
};

var cleanTxout = function(txout) {
    if (txout.type === 'witnessscripthash') {
        txout.type = 'unknown';
        txout.address = null;
    }

    if (!txout.spent_hash) {
        txout.spent_index = -1;
    }

    delete txout.multisig;
    delete txout.multisig_addresses;
};

var cleanTx = function(tx) {
    [
        'block_hash', // @TODO
        'confirmations', 'estimated_change', 'estimated_change_address', 'estimated_value',
        'is_coinbase', 'time', 'version', 'weight', 'witness_hash', 'is_double_spend', 'is_sw_tx',
        'sigops', 'lock_time', 'contains_dust', 'double_spend_in', 'enough_fee', 'first_seen_at',
        'last_seen_at', 'high_priority', 'unconfirmed_inputs'
    ].forEach(function(prop) {
        delete tx[prop];
    });

    tx.inputs.forEach(function(txin) {
        cleanTxin(txin);
    });

    tx.outputs.forEach(function(txout) {
        cleanTxout(txout);
    });
};

var cleanBlock = function(block) {
    delete block.confirmations;
    delete block.is_sw_block;
    delete block.created_at;
    delete block.bits;
    delete block.reward_block;
    delete block.reward_fees;
    delete block.weight;
    delete block.value;
};

describe('data api', function() {
    it('test address', function(cb) {
        client.address("3EU8LRmo5PgcSwnkn6Msbqc8BKNoQ7Xief", function(err, address) {
            assert.ifError(err);
            assert.ok(address['address']);
            assert.equal(address['address'], '3EU8LRmo5PgcSwnkn6Msbqc8BKNoQ7Xief');

            // trim off deprecated fields
            delete address.category;
            delete address.tag;
            delete address.first_seen;
            delete address.last_seen;
            delete address.total_transactions_in;
            delete address.total_transactions_out;
            delete address.unconfirmed_utxos;
            // trim off new fields
            delete address.first_tx;
            delete address.last_tx;

            assert.deepEqual(
                address,
                require('./test_data/address.3EU8LRmo5PgcSwnkn6Msbqc8BKNoQ7Xief')
            );

            cb();
        });
    });
    it('test addressTransactions', function(cb) {
        client.addressTransactions("3EU8LRmo5PgcSwnkn6Msbqc8BKNoQ7Xief", {limit: 20}, function(err, address_txs) {
            assert.ifError(err);

            assert.ok(address_txs['data']);
            assert.ok(address_txs['total']);

            var expected = require('./test_data/addressTxs.3EU8LRmo5PgcSwnkn6Msbqc8BKNoQ7Xief');
            var expectedTxMap = {};
            expected.data.forEach(function(tx) {
                cleanTx(tx);
                expectedTxMap[tx.hash] = tx;
            });

            address_txs.data.forEach(function(tx) {
                cleanTx(tx);
                assert.deepEqual(tx, expectedTxMap[tx.hash]);
            });

            cb();
        });
    });
    it('test addressUnconfirmedTransactions', function(cb) {
        client.addressUnconfirmedTransactions("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", {limit: 23}, function(err, address_txs) {
            assert.ifError(err);
            assert.ok('data' in address_txs);
            assert.ok('total' in address_txs);
            assert.ok(address_txs['total'] >= address_txs['data'].length);

            cb();
        });
    });
    it('test addressUnspentOutputs', function(cb) {
        client.addressUnspentOutputs("3EU8LRmo5PgcSwnkn6Msbqc8BKNoQ7Xief", {limit: 23}, function(err, address_utxo) {
            assert.ifError(err);
            assert.ok('data' in address_utxo);
            assert.ok('total' in address_utxo);
            assert.ok(address_utxo['total'] >= address_utxo['data'].length);

            cb();
        });
    });
    it('test batchAddressUnspentOutputs', function(cb) {
        client.batchAddressUnspentOutputs(["16dwJmR4mX5RguGrocMfN9Q9FR2kZcLw2z", "3EU8LRmo5PgcSwnkn6Msbqc8BKNoQ7Xief"], {limit: 23}, function(err, address_utxo) {
            console.log(address_utxo);
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

            var expected = require('./test_data/block.000000000000034a7dedef4a161fa058a2d67a173a90155f3a2fe6fc132e0ebf');

            cleanBlock(block);
            cleanBlock(expected);

            assert.deepEqual(block, expected);

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
        client.allBlocks({page: 2, limit: 23, sort_dir: 'asc'}, function(err, blocks) {
            assert.ifError(err);

            assert.ok(blocks['data']);
            assert.ok(blocks['total']);
            assert.ok(blocks['data'].length === 23);

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
    it('test tx 95740451ac22f63c42c0d1b17392a0bf02983176d6de8dd05d6f06944d93e615', function(cb) {
        client.transaction("95740451ac22f63c42c0d1b17392a0bf02983176d6de8dd05d6f06944d93e615", function(err, tx) {
            assert.ifError(err);
            assert.equal(tx['hash'], "95740451ac22f63c42c0d1b17392a0bf02983176d6de8dd05d6f06944d93e615");

            var expected = require('./test_data/tx.95740451ac22f63c42c0d1b17392a0bf02983176d6de8dd05d6f06944d93e615');
            cleanTx(expected);
            cleanTx(tx);

            assert.deepEqual(tx, expected);

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
            "1f0a168f0fceb6e48208b23ffb1ad528acfc11c30ab302d447743f2a0fc5fe80"
        ], function(err, txs) {
            assert.ifError(err);

            assert.equal(Object.keys(txs['data']).length, 8);

            var tx1 = txs['data']["c791b82ed9af681b73eadb7a05b67294c1c3003e52d01e03775bfb79d4ac58d1"];
            assert.equal(tx1['hash'], "c791b82ed9af681b73eadb7a05b67294c1c3003e52d01e03775bfb79d4ac58d1");
            assert.ok(tx1['confirmations']);

            var tx2 = txs['data']["0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098"];
            assert.equal(tx2['hash'], "0e3e2357e806b6cdb1f70b54c3a3a17b6714ee1f0e68bebb44a74b1efd512098");

            var tx8 = txs['data']["1f0a168f0fceb6e48208b23ffb1ad528acfc11c30ab302d447743f2a0fc5fe80"];
            assert.equal(tx8['hash'], "1f0a168f0fceb6e48208b23ffb1ad528acfc11c30ab302d447743f2a0fc5fe80");

            assert.ok(!txs['data']['ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff']);

            cb();
        });
    });
});

