/* jshint -W101, -W098 */
var assert = require('assert');
var BtccomConverter = require("../lib/btccom.convert");
var network = {
    messagePrefix: '\u0018Bitcoin Signed Message:\n',
    bech32: 'bc',
    bip32: { public: 76067358, private: 76066276 },
    pubKeyHash: 0,
    scriptHash: 5,
    wif: 128
};
var useNewCashAddr = true;
var converter = new BtccomConverter(network, useNewCashAddr);

describe("btccom.convert", function() {
    describe("convertBlock", function() {
        it("works", function(cb) {
            var input = require('./test_data/btccomconvert.block');

            var output = converter.convertBlock(input);

            // assert fields match
            [
                ["height", "height"],
                ["is_orphan", "is_orphan"],
                ["merkleroot", "mrkl_root"],
                ["hash", "hash"],
                ["prev_block", "prev_block_hash"],
                ["next_block", "next_block_hash"],
                ["transactions", "tx_count"]
            ].forEach(function(keyAssoc) {
                var blocktrailKey = keyAssoc[0];
                var btccomKey = keyAssoc[1];
                assert.ok(blocktrailKey in output);
                assert.ok(input.data[btccomKey] === output[blocktrailKey]);
            });

            cb();
        });
    });

    describe("convertBlockTxs", function() {
        it("works", function(cb) {
            var input = require('./test_data/btccomconvert.blocktxs');

            var output = converter.convertBlockTxs(input);
            assert.ok("current_page" in output);
            assert.ok("per_page" in output);
            assert.ok("total" in output);

            // assert fields match
            [
                ["size", "size"],
                ["hash", "hash"],
                ["confirmations", "confirmations"],
                ["is_coinbase", "is_coinbase"],
                ["total_fee", "fee"],
                ["size", "size"],
                ["is_double_spend", "is_double_spend"]

            ].forEach(function(keyAssoc) {
                var blocktrailKey = keyAssoc[0];
                var btccomKey = keyAssoc[1];
                var blockTx = output.data[0];
                assert.ok(blocktrailKey in blockTx);
                assert.ok(input.data.list[0][btccomKey] === blockTx[blocktrailKey]);
            });

            cb();
        });
    });

    describe("convertTx", function() {
        it("works", function(cb) {
            var input = require('./test_data/btccomconvert.tx');

            var output = converter.convertTx(input);
            assert.ok("hash" in output);

            // assert fields match
            [
                ["size", "size"],
                ["hash", "hash"],
                ["confirmations", "confirmations"],
                ["is_coinbase", "is_coinbase"],
                ["block_height", "block_height"],
                ["total_fee", "fee"],
                ["size", "size"],
                ["is_double_spend", "is_double_spend"]

            ].forEach(function(keyAssoc) {
                var blocktrailKey = keyAssoc[0];
                var btccomKey = keyAssoc[1];
                var blockTx = output;
                assert.ok(blocktrailKey in blockTx);
                assert.ok(input.data[btccomKey] === blockTx[blocktrailKey]);
            });

            cb();
        });

    });

    describe("convertAddress", function() {
        it("works", function(cb) {
            var input = require('./test_data/btccomconvert.address');

            var output = converter.convertAddress(input);

            // assert fields match
            [
                ["address", "address"],
                ["balance", "balance"],
                ["received", "received"],
                ["sent", "sent"],
                ["transactions", "tx_count"],
                ["unconfirmed_received", "unconfirmed_received"],
                ["unconfirmed_sent", "unconfirmed_sent"],
                ["unconfirmed_transactions", "unconfirmed_tx_count"],
                ["first_tx", "first_tx"],
                ["last_tx", "last_tx"]

            ].forEach(function(keyAssoc) {
                var blocktrailKey = keyAssoc[0];
                var btccomKey = keyAssoc[1];

                assert.ok(blocktrailKey in output, blocktrailKey);
                assert.ok(input.data[btccomKey] === output[blocktrailKey], blocktrailKey);
            });

            cb();
        });
    });

    describe("convertAddressTxs", function() {
        it("works", function(cb) {
            var input = require('./test_data/btccomconvert.addresstxs');

            var output = converter.convertAddressTxs(input);
            assert.ok("total" in output);
            cb();
        });
    });

    describe ("convertAddressUnspentOutputs", function() {
        it("works", function(cb) {
            var input = require('./test_data/btccomconvert.addressutxos');

            var output = converter.convertAddressUnspentOutputs(input, "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");

            // assert fields match
            [
                ["hash", "tx_hash"],
                ["confirmations", "confirmations"],
                ["value", "value"],
                ["index", "tx_output_n"]

            ].forEach(function(keyAssoc) {
                var blocktrailKey = keyAssoc[0];
                var btccomKey = keyAssoc[1];

                var blockTx = output.data[0];
                assert.ok(blocktrailKey in blockTx);
                assert.ok(input.data.list[0][btccomKey] === blockTx[blocktrailKey]);
            });

            assert.ok("total" in output);
            cb();
        });
    });
});




