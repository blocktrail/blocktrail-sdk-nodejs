var _ = require('lodash');
var blocktrail = require('../');
var assert = require('assert');
var crypto = require('crypto');
var async = require('async');
var bitcoin = require('bitcoinjs-lib');
var bip39 = require("bip39");

/**
 * @type APIClient
 */
var client = blocktrail.BlocktrailSDK({
    apiKey : process.env.BLOCKTRAIL_SDK_APIKEY || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APIKEY",
    apiSecret : process.env.BLOCKTRAIL_SDK_APISECRET || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APISECRET",
    testnet : true
});

var createDiscoveryTestWallet = function(identifier, passphrase, cb) {
    var primaryMnemonic = "give pause forget seed dance crawl situate hole kingdom";
    var backupMnemonic = "give pause forget seed dance crawl situate hole course";

    return _createTestWallet(identifier, passphrase, primaryMnemonic, backupMnemonic, cb);
};

var createTransactionTestWallet = function(identifier, passphrase, cb) {
    var primaryMnemonic = "give pause forget seed dance crawl situate hole keen";
    var backupMnemonic = "give pause forget seed dance crawl situate hole give";

    return _createTestWallet(identifier, passphrase, primaryMnemonic, backupMnemonic, cb);
};

var createRecoveryTestWallet = function(identifier, passphrase, cb) {
    var primaryMnemonic = "give pause forget seed dance crawl situate hole join";
    var backupMnemonic = "give pause forget seed dance crawl situate hole crater";

    return _createTestWallet(identifier, passphrase, primaryMnemonic, backupMnemonic, cb);
};

var _createTestWallet = function(identifier, passphrase, primaryMnemonic, backupMnemonic, cb) {
    var keyIndex = 9999;

    var primaryPrivateKey = bitcoin.HDNode.fromSeedBuffer(
        bip39.mnemonicToSeed(primaryMnemonic, passphrase),
        client.testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin
    );
    var primaryPublicKey = primaryPrivateKey.deriveHardened(keyIndex).neutered();
    primaryPublicKey = [primaryPublicKey.toBase58(), "M/" + keyIndex + "'"];

    var backupPrivateKey = bitcoin.HDNode.fromSeedBuffer(
        bip39.mnemonicToSeed(backupMnemonic, ""),
        client.testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin
    );
    var backupPublicKey = backupPrivateKey.neutered();
    backupPublicKey = [backupPublicKey.toBase58(), "M"];

    // @TODO: checksum
    var checksum = primaryPrivateKey.getAddress().toBase58Check();

    client._createNewWallet(identifier, primaryPublicKey, backupPublicKey, primaryMnemonic, checksum, keyIndex, function(err, result) {

        var blocktrailPubKeys = result.blocktrail_public_keys;

        var wallet = new blocktrail.Wallet(
            client,
            identifier,
            primaryMnemonic,
            primaryPrivateKey,
            backupPublicKey,
            blocktrailPubKeys,
            keyIndex,
            client.testnet
        );

        cb(null, wallet);
    });
};

describe('test new blank wallet', function() {
    var myIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');
    var wallet;

    after(function(cb) {
        wallet && wallet.deleteWallet(true, function(err, result) {
            cb();
        });
    });

    it("shouldn't already exist", function(cb) {
        client.initWallet(myIdentifier, "password", function(err, wallet) {
            assert.ok(err);
            assert.ok(!wallet, "wallet with random ID [" + myIdentifier + "] already exists...");

            cb();
        });
    });

    it("should be created", function(cb) {
        client.createNewWallet(myIdentifier, "password", 9999, function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            wallet = _wallet;

            assert.equal(wallet.identifier, myIdentifier);
            assert.equal(wallet.blocktrailPublicKeys[9999][0], "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            assert.equal(wallet.getBlocktrailPublicKey("m/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            cb();
        });
    });

    it("should have a 0 balance", function(cb) {
        wallet.getBalance(function(err, confirmed, unconfirmed) {
            assert.ifError(err);
            assert.equal(confirmed, 0);
            assert.equal(unconfirmed, 0);

            cb();
        });
    });

    it("shouldn't be able to pay", function(cb) {
        wallet.pay({
            "2N6Fg6T74Fcv1JQ8FkPJMs8mYmbm9kitTxy": blocktrail.toSatoshi(0.001)
        }, function(err, txHash) {
            assert.ok(!!err);

            cb();
        });
    });
});

describe('test wallet, do transaction', function() {
    var wallet;

    it("should exists", function(cb) {
        client.initWallet("unittest-transaction", "password", function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            wallet = _wallet;

            assert.equal(wallet.primaryMnemonic, "give pause forget seed dance crawl situate hole keen");
            assert.equal(wallet.identifier, "unittest-transaction");
            assert.equal(wallet.blocktrailPublicKeys[9999][0], "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            assert.equal(wallet.getBlocktrailPublicKey("m/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            cb();
        });
    });

    it("should have the expected addresses", function(cb) {
        assert.equal(wallet.getAddressByPath("M/9999'/0/1"), "2N65RcfKHiKQcPGZAA2QVeqitJvAQ8HroHD");
        assert.equal(wallet.getAddressByPath("M/9999'/0/6"), "2MynrezSyqCq1x5dMPtRDupTPA4sfVrNBKq");
        assert.equal(wallet.getAddressByPath("M/9999'/0/44"), "2N5eqrZE7LcfRyCWqpeh1T1YpMdgrq8HWzh");

        cb();
    });

    it("should have a balance", function(cb) {
        this.timeout(0);

        wallet.getBalance(function(err, confirmed, unconfirmed) {
            assert.ok(confirmed + unconfirmed > 0);
            assert.ok(confirmed > 0);

            cb();
        });
    });

    it("should be able to do a payment", function(cb) {
        wallet.getNewAddress(function(err, address, path) {
            assert.ifError(err);
            assert.ok(path.indexOf("M/9999'/0/") === 0);
            assert.ok(bitcoin.Address.fromBase58Check(address));

            var pay = {};
            pay[address] = blocktrail.toSatoshi(0.001);

            wallet.pay(pay, function(err, txHash) {
                assert.ifError(err);
                assert.ok(txHash);

                client.transaction(txHash, function(err, tx) {
                    assert.ifError(err);
                    assert.ok(tx);

                    cb();
                });
            });
        });
    });
});

describe('test wallet discovery and upgrade key index', function() {
    var myIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');
    var wallet;

    after(function(cb) {
        wallet && wallet.deleteWallet(true, function(err, result) {
            cb();
        });
    });

    it("should be created", function(cb) {
        createDiscoveryTestWallet(myIdentifier, "password", function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            wallet = _wallet;

            assert.equal(wallet.primaryMnemonic, "give pause forget seed dance crawl situate hole kingdom");
            assert.equal(wallet.identifier, myIdentifier);
            assert.equal(wallet.blocktrailPublicKeys[9999][0], "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            assert.equal(wallet.getBlocktrailPublicKey("m/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");

            cb();
        });
    });

    it("should have the expected addresses", function(cb) {
        async.series([
            function(cb) {
                wallet.getNewAddress(function(err, address, path) {
                    assert.ifError(err);
                    assert.equal(path, "M/9999'/0/0");
                    assert.equal(address, "2Mtfn5S9tVWnnHsBQixCLTsCAPFHvfhu6bM");

                    cb();
                });
            },
            function(cb) {
                wallet.getNewAddress(function(err, address, path) {
                    assert.ifError(err);
                    assert.equal(path, "M/9999'/0/1");
                    assert.equal(address, "2NG49GDkm5qCYvDFi4cxAnkSho8qLbEz6C4");

                    cb();
                });
            },
            function(cb) {
                assert.equal(wallet.getAddressByPath("M/9999'/0/1"), "2NG49GDkm5qCYvDFi4cxAnkSho8qLbEz6C4");
                assert.equal(wallet.getAddressByPath("M/9999'/0/6"), "2N1kM5xeDaCN9Weog3mbyxjpryNZcirnkB7");

                cb();
            },
        ], cb);
    });

    it("should have a balance after discovery", function(cb) {
        this.timeout(0);

        wallet.doDiscovery(50, function(err, confirmed, unconfirmed) {
            assert.ok(confirmed + unconfirmed > 0);

            cb();
        });
    });

    it("should be upgraded and have expected addresses", function(cb) {
        wallet.upgradeKeyIndex(10000, function(err) {
            assert.ifError(err);

            assert.equal(wallet.blocktrailPublicKeys[10000][0], "tpubD9m9hziKhYQExWgzMUNXdYMNUtourv96sjTUS9jJKdo3EDJAnCBJooMPm6vGSmkNTNAmVt988dzNfNY12YYzk9E6PkA7JbxYeZBFy4XAaCp");

            assert.equal(wallet.getAddressByPath("M/10000'/0/0"), "2N9ZLKXgs12JQKXvLkngn7u9tsYaQ5kXJmk");

            wallet.getNewAddress(function(err, address, path) {
                assert.ifError(err);
                assert.equal(path, "M/10000'/0/0");
                assert.equal(address, "2N9ZLKXgs12JQKXvLkngn7u9tsYaQ5kXJmk");

                cb();
            });
        });
    });
});

describe('test wallet with bad password', function() {
    var myIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');
    var wallet;

    after(function(cb) {
        wallet && wallet.deleteWallet(true, function(err, result) {
            cb();
        });
    });

    it("should be created", function(cb) {
        createDiscoveryTestWallet(myIdentifier, "badpassword", function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            wallet = _wallet;

            assert.equal(wallet.primaryMnemonic, "give pause forget seed dance crawl situate hole kingdom");
            assert.equal(wallet.identifier, myIdentifier);
            assert.equal(wallet.blocktrailPublicKeys[9999][0], "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            assert.equal(wallet.getBlocktrailPublicKey("m/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");

            cb();
        });
    });

    it("should have the expected addresses (different from with the correct password)", function(cb) {
        async.series([
            function(cb) {
                wallet.getNewAddress(function(err, address, path) {
                    assert.ifError(err);
                    assert.equal(path, "M/9999'/0/0");
                    assert.equal(address, "2N9SGrV4NKRjdACYvHLPpy2oiPrxTPd44rg");

                    cb();
                });
            },
            function(cb) {
                wallet.getNewAddress(function(err, address, path) {
                    assert.ifError(err);
                    assert.equal(path, "M/9999'/0/1");
                    assert.equal(address, "2NDq3DRy9E3YgHDA3haPJj3FtUS6V93avkf");

                    cb();
                });
            }
        ], cb);
    });

    it("shouldn't have a balance after discovery", function(cb) {
        this.timeout(0);

        wallet.doDiscovery(50, function(err, confirmed, unconfirmed) {
            assert.ok(confirmed + unconfirmed == 0);

            cb();
        });
    });
});

describe('test wallet webhook', function() {
    // this.timeout(0); // disable, can take long

    var myIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');
    var wallet;

    after(function(cb) {
        wallet && wallet.deleteWallet(true, function(err, result) {
            cb();
        });
    });

    it("shouldn't already exist", function(cb) {
        client.initWallet(myIdentifier, "password", function(err, wallet) {
            assert.ok(err);
            assert.ok(!wallet, "wallet with random ID [" + myIdentifier + "] already exists...");

            cb();
        });
    });

    it("should be created", function(cb) {
        client.createNewWallet(myIdentifier, "password", 9999, function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            wallet = _wallet;

            assert.equal(wallet.identifier, myIdentifier);
            assert.equal(wallet.blocktrailPublicKeys[9999][0], "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            assert.equal(wallet.getBlocktrailPublicKey("m/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            cb();
        });
    });

    it("should have a 0 balance", function(cb) {
        wallet.getBalance(function(err, confirmed, unconfirmed) {
            assert.ifError(err);
            assert.equal(confirmed, 0);
            assert.equal(unconfirmed, 0);

            cb();
        });
    });

    it("should be able to create a webhook", function(cb) {
        wallet.setupWebhook("https://www.blocktrail.com/webhook-test", function(err, webhook) {
            assert.ifError(err);
            assert.equal(webhook['url'], "https://www.blocktrail.com/webhook-test");
            assert.equal(webhook['identifier'], "WALLET-" + myIdentifier);

            wallet.deleteWebhook(function(err, result) {
                assert.ifError(err);

                cb();
            });
        });
    });

    it("should be able to create a webhook with custom identifier", function(cb) {
        var myWebhookIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');

        wallet.setupWebhook("https://www.blocktrail.com/webhook-test", myWebhookIdentifier, function(err, webhook) {
            assert.ifError(err);
            assert.equal(webhook['url'], "https://www.blocktrail.com/webhook-test");
            assert.equal(webhook['identifier'], myWebhookIdentifier);

            client.getWebhookEvents(myWebhookIdentifier, function(err, result) {
                assert.ifError(err);
                
                wallet.getNewAddress(function(err, address1) {
                    assert.ifError(err);

                    wallet.deleteWebhook(myWebhookIdentifier, function(err, result) {
                        assert.ifError(err);

                        var myWebhookIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');

                        wallet.setupWebhook("https://www.blocktrail.com/webhook-test", myWebhookIdentifier, function(err, webhook) {
                            assert.ifError(err);
                            assert.equal(webhook['url'], "https://www.blocktrail.com/webhook-test");
                            assert.equal(webhook['identifier'], myWebhookIdentifier);

                            client.getWebhookEvents(myWebhookIdentifier, function(err, result) {
                                assert.ifError(err);
                                assert.ok(_.contains(_.map(result['data'], 'address'), address1));

                                wallet.getNewAddress(function(err, address2) {
                                    assert.ifError(err);

                                    client.getWebhookEvents(myWebhookIdentifier, function(err, result) {
                                        assert.ifError(err);
                                        assert.ok(_.contains(_.map(result['data'], 'address'), address2));

                                        wallet.deleteWallet(function(err, result) {
                                            assert.ifError(err);
                                            assert.ok(result);

                                            client.deleteWebhook(myWebhookIdentifier, function(err, result) {
                                                assert.ok(err);

                                                cb();
                                            });
                                        });
                                    })

                                });
                            });
                        });
                    });

                });
            });
        });
    });
});

describe('test wallet list transactions and addresses', function() {
    var wallet;

    it("should exists", function(cb) {
        client.initWallet("unittest-transaction", "password", function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            wallet = _wallet;

            client.allWallets({page: 1}, function(err, wallets) {
                assert.ifError(err);

                assert.ok(wallets['data'].length > 0);

                assert.equal(wallet.primaryMnemonic, "give pause forget seed dance crawl situate hole keen");
                assert.equal(wallet.identifier, "unittest-transaction");
                assert.equal(wallet.blocktrailPublicKeys[9999][0], "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
                assert.equal(wallet.getBlocktrailPublicKey("m/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
                assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");

                cb();
            });
        });
    });

    it("should list expected transactions", function(cb) {
        wallet.transactions({page: 1, limit: 23}, function(err, transactions) {
            assert.ifError(err);
            assert.ok(transactions['data']);
            assert.ok(transactions['total']);
            assert.ok(transactions['data'].length == 23);
            assert.ok(transactions['data'][0]['hash'], "2cb21783635a5f22e9934b8c3262146b42d251dfb14ee961d120936a6c40fe89");

            cb();
        });
    });

    it("should list expected addresses", function(cb) {
        wallet.addresses({page: 1, limit: 23}, function(err, addresses) {
            assert.ifError(err);
            assert.ok(addresses['data']);
            assert.ok(addresses['total']);
            assert.ok(addresses['data'].length == 23);
            assert.ok(addresses['data'][0]['address'], "2MzyKviSL6pnWxkbHV7ecFRE3hWKfzmT8WS");

            cb();
        });
    });

    it("should list UTXOs", function (cb) {
        wallet.utxos({page: 0, limit: 23}, function (err, addresses) {
            assert.ifError(err);
            assert.ok(addresses['data']);
            assert.ok(addresses['total']);
            assert.ok(addresses['data'].length === 23);

            cb();
        });
    });
});
