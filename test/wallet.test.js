/* jshint -W101, -W098 */
/* global window */
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
    apiKey : process.env.BLOCKTRAIL_SDK_APIKEY || window.BLOCKTRAIL_SDK_APIKEY || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APIKEY",
    apiSecret : process.env.BLOCKTRAIL_SDK_APISECRET || window.BLOCKTRAIL_SDK_APISECRET || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APISECRET",
    testnet : true
});

var TRANSACTION_TEST_WALLET_PRIMARY_MNEMONIC = "give pause forget seed dance crawl situate hole keen",
    TRANSACTION_TEST_WALLET_BACKUP_MNEMONIC = "give pause forget seed dance crawl situate hole give",
    TRANSACTION_TEST_WALLET_PASSWORD = "password";

var _createTestWallet = function(identifier, passphrase, primaryMnemonic, backupMnemonic, cb) {
    var keyIndex = 9999;
    var network = client.testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

    var primarySeed = bip39.mnemonicToSeed(primaryMnemonic, passphrase);
    var primaryPrivateKey = bitcoin.HDNode.fromSeedBuffer(primarySeed, network);

    var backupSeed = bip39.mnemonicToSeed(backupMnemonic, "");
    var backupPrivateKey = bitcoin.HDNode.fromSeedBuffer(backupSeed, network);
    var backupPublicKey = backupPrivateKey.neutered();

    var checksum = primaryPrivateKey.getAddress().toBase58Check();
    var primaryPublicKey = primaryPrivateKey.deriveHardened(keyIndex).neutered();

    client.storeNewWalletV1(
        identifier,
        [primaryPublicKey.toBase58(), "M/" + keyIndex + "'"],
        [backupPublicKey.toBase58(), "M"],
        primaryMnemonic,
        checksum,
        keyIndex,
        function(err, result) {
            if (err) {
                return cb(err);
            }

            var blocktrailPublicKeys = _.mapValues(result.blocktrail_public_keys, function(blocktrailPublicKey) {
                return bitcoin.HDNode.fromBase58(blocktrailPublicKey[0], network);
            });

            var wallet = new blocktrail.Wallet(
                client,
                identifier,
                blocktrail.Wallet.WALLET_VERSION_V1,
                primaryMnemonic,
                null,
                null,
                {keyIndex: primaryPublicKey},
                backupPublicKey,
                blocktrailPublicKeys,
                keyIndex,
                client.testnet,
                checksum
            );

            wallet.unlock({
                passphrase: passphrase
            }, function(err) {
                cb(err, wallet);
            });
        }
    );
};

var createDiscoveryTestWallet = function(identifier, passphrase, cb) {
    var primaryMnemonic = "give pause forget seed dance crawl situate hole kingdom";
    var backupMnemonic = "give pause forget seed dance crawl situate hole course";

    return _createTestWallet(identifier, passphrase, primaryMnemonic, backupMnemonic, cb);
};

var createTransactionTestWallet = function(identifier, cb) {
    return _createTestWallet(identifier, TRANSACTION_TEST_WALLET_PASSWORD, TRANSACTION_TEST_WALLET_PRIMARY_MNEMONIC, TRANSACTION_TEST_WALLET_BACKUP_MNEMONIC, cb);
};

var createRecoveryTestWallet = function(identifier, passphrase, cb) {
    var primaryMnemonic = "give pause forget seed dance crawl situate hole join";
    var backupMnemonic = "give pause forget seed dance crawl situate hole crater";

    return _createTestWallet(identifier, passphrase, primaryMnemonic, backupMnemonic, cb);
};

/**
 * Test operations on v2 and v3 wallets.
 * Also tests the default, encouraging to look at this test if it changes again.
 */
[
  blocktrail.Wallet.WALLET_VERSION_V2,
  blocktrail.Wallet.WALLET_VERSION_V3,
  null /* test our assumed default version */
].map(function(walletVersion) {
    var assumedDefault = blocktrail.Wallet.WALLET_VERSION_V3;
    describe('test new blank wallet, ' + walletVersion, function() {
        var myIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');
        var wallet;

        after(function(cb) {
            if (wallet) {
                wallet.deleteWallet(true, function(err, result) {
                    cb();
                });
            } else {
                cb();
            }
        });

        it("shouldn't already exist", function(cb) {
            client.initWallet({
                identifier: myIdentifier,
                readOnly: true
            }, function(err, wallet) {
                assert.ok(err);
                assert.ok(!wallet, "wallet with random ID [" + myIdentifier + "] already exists...");

                cb();
            });
        });

        it("should be created", function(cb) {
            var progress = [];
            var cnf = {
                identifier: myIdentifier,
                passphrase: "password",
                keyIndex: 9999
            };

            var expectedVersion = assumedDefault;
            if (walletVersion !== null) {
                cnf.walletVersion = walletVersion;
                expectedVersion = walletVersion;
            }

            client.createNewWallet(cnf, function(err, _wallet, backupInfo) {
                assert.ifError(err);
                assert.ok(_wallet);

                wallet = _wallet;
                assert.equal(wallet.walletVersion, expectedVersion);
                assert.equal(wallet.identifier, myIdentifier);
                assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");

                assert.deepEqual(progress, [
                    blocktrail.CREATE_WALLET_PROGRESS_START,
                    blocktrail.CREATE_WALLET_PROGRESS_ENCRYPT_SECRET,
                    blocktrail.CREATE_WALLET_PROGRESS_ENCRYPT_PRIMARY,
                    blocktrail.CREATE_WALLET_PROGRESS_ENCRYPT_RECOVERY,
                    blocktrail.CREATE_WALLET_PROGRESS_PRIMARY,
                    blocktrail.CREATE_WALLET_PROGRESS_BACKUP,
                    blocktrail.CREATE_WALLET_PROGRESS_SUBMIT,
                    blocktrail.CREATE_WALLET_PROGRESS_INIT,
                    blocktrail.CREATE_WALLET_PROGRESS_DONE
                ]);

                cb();
            })
            .progress(function(p) { progress.push(p); });
        });

        it("should lock", function(cb) {
            assert(!wallet.locked);
            wallet.lock();
            assert(wallet.locked);
            cb();
        });

        it("should init", function(cb) {
            client.initWallet({
                identifier: myIdentifier,
                readOnly: true
            }, function(err, _wallet) {
                assert.ifError(err);
                assert.ok(_wallet);

                wallet = _wallet;

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

        it("shouldn't be able to pay when locked", function(cb) {
            wallet.pay({
                "2N6Fg6T74Fcv1JQ8FkPJMs8mYmbm9kitTxy": blocktrail.toSatoshi(0.001)
            }, function(err, txHash) {
                assert.ok(!!err && err.message.match(/unlocked/));
                assert.ok(err instanceof blocktrail.WalletLockedError);

                cb();
            });
        });

        it("shouldn't be able to upgrade when locked", function(cb) {
            wallet.upgradeKeyIndex(10000, function(err) {
                assert.ok(!!err && err.message.match(/unlocked/));
                assert.ok(err instanceof blocktrail.WalletLockedError);

                cb();
            });
        });

        it("should unlock", function(cb) {
            wallet.unlock({password: "password"}, function(err) {
                assert.ifError(err);

                cb();
            });
        });

        it("should be able to unlock with secret", function(cb) {
            var secret = wallet.secret;

            wallet.lock();
            wallet.unlock({secret: secret}, function(err) {
                assert.ifError(err);
                cb();
            });
        });

        it("shouldn't be able to pay when unlocked (because of no balance)", function(cb) {
            wallet.pay({
                "2N6Fg6T74Fcv1JQ8FkPJMs8mYmbm9kitTxy": blocktrail.toSatoshi(0.001)
            }, function(err, txHash) {
                assert.ok(!!err && err.message.match(/balance/));

                cb();
            });
        });

        it("should be able to upgrade when unlocked", function(cb) {
            wallet.upgradeKeyIndex(10000, function(err) {
                assert.ifError(err);

                cb();
            });
        });

        it("should be able to password change", function(cb) {
            wallet.passwordChange("password2", function(err) {
                assert.ifError(err);

                client.initWallet({
                    identifier: myIdentifier,
                    password: "password2"
                }, function(err, _wallet) {
                    assert.ifError(err);
                    assert.ok(_wallet);

                    wallet = _wallet;

                    cb();
                });
            });
        });
    });
});

/**
 * Test operations on v2 and v3 wallets.
 */
[
    blocktrail.Wallet.WALLET_VERSION_V1,
    blocktrail.Wallet.WALLET_VERSION_V2,
    blocktrail.Wallet.WALLET_VERSION_V3
].map(function(walletVersion) {
    var primarySeed = bip39.mnemonicToSeed(TRANSACTION_TEST_WALLET_PRIMARY_MNEMONIC, TRANSACTION_TEST_WALLET_PASSWORD);

    describe('test input errors, ' + walletVersion, function() {
        it("shouldn't allow primaryPrivateKey in creation", function(cb) {
            var myIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');
            var primaryPrivateKey = bitcoin.HDNode.fromSeedBuffer(primarySeed, bitcoin.networks.testnet);

            client.createNewWallet({
                identifier: myIdentifier,
                passphrase: "password",
                primaryPrivateKey: primaryPrivateKey,
                walletVersion: walletVersion,
                keyIndex: 9999
            }, function(err, wallet) {
                assert.ok(!!err, "should error");

                cb();
            });
        });

        it("shouldn't allow unlocking with primaryPrivateKey", function(cb) {
            client.createNewWallet({
                identifier: "unittest-transaction-inputerr-" + walletVersion,
                primarySeed: primarySeed,
                walletVersion: walletVersion,
                keyIndex: 9999
            }).then(function(r) {
                var wallet = r[0];
                wallet.lock();
                return wallet;
            }, function(err) {
                assert.ok(err.message.match(/already exists/));

                return client.initWallet({
                    identifier: "unittest-transaction-inputerr-" + walletVersion,
                    readOnly: true
                });
            }).then(function(wallet) {
                assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");

                return wallet.unlock({primaryPrivateKey: bitcoin.HDNode.fromSeedBuffer(primarySeed, bitcoin.networks.testnet)})
                    .then(function() {
                        return;
                    }, function(err) {
                        return err;
                    });
            })
                .then(function(err) {
                    assert.ok(!!err, "should error");
                    cb();
                })
                .done();
        });
    });
});

/**
 * Test upgrade to V3 from V1 and V2
 */
[
    blocktrail.Wallet.WALLET_VERSION_V1,
    blocktrail.Wallet.WALLET_VERSION_V2
].map(function(walletVersion) {
    describe("upgrade to V3 from " + walletVersion, function() {
        var myIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');
        var passphrase = "password";
        var wallet;

        after(function(cb) {
            if (wallet) {
                wallet.deleteWallet(true, function(err, result) {
                    console.log(err, result);
                    cb();
                });
            } else {
                cb();
            }
        });

        it("can upgrade", function() {
            var addr;

            return client.createNewWallet({
                identifier: myIdentifier,
                passphrase: passphrase,
                walletVersion: walletVersion,
                keyIndex: 9999
            })
                .then(function(r) {
                    return r[0];
                })
                .then(function(_wallet) {
                    wallet = _wallet;
                    addr = wallet.getAddressByPath("M/9999'/0/0");

                    return wallet;
                })
                .then(function(wallet) {
                    var progress = [];

                    return wallet.upgradeToV3(passphrase)
                        .progress(function(p) {
                            progress.push(p);
                        })
                        .then(function() {
                            assert(progress.length);
                            return wallet;
                        });
                })
                .then(function(wallet) {
                    assert.equal(addr, wallet.getAddressByPath("M/9999'/0/0"));
                });
        });

        it("can unlock with secret", function() {
            var secret = wallet.secret;
            wallet.lock();
            return wallet.unlock({secret: secret});
        });

        it("can init after upgrade", function() {
            return client.initWallet({
                identifier: myIdentifier,
                passphrase: passphrase,
                keyIndex: 9999
            });
        });
    });
});

describe('test new blank wallet, v1', function() {
    var myIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');
    var wallet;

    after(function(cb) {
        if (wallet) {
            wallet.deleteWallet(true, function(err, result) {
                cb();
            });
        } else {
            cb();
        }
    });

    it("shouldn't already exist", function(cb) {
        client.initWallet({
            identifier: myIdentifier,
            readOnly: true
        }, function(err, wallet) {
            assert.ok(err);
            assert.ok(!wallet, "wallet with random ID [" + myIdentifier + "] already exists...");

            cb();
        });
    });

    it("should be created", function(cb) {
        var progress = [];

        client.createNewWallet({
                identifier: myIdentifier,
                passphrase: "password",
                keyIndex: 9999,
                walletVersion: blocktrail.Wallet.WALLET_VERSION_V1
            }, function(err, _wallet) {
                assert.ifError(err);
                assert.ok(_wallet);

                wallet = _wallet;

                assert.equal(wallet.identifier, myIdentifier);
                assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");

                assert.deepEqual(progress, [
                    blocktrail.CREATE_WALLET_PROGRESS_START,
                    blocktrail.CREATE_WALLET_PROGRESS_PRIMARY,
                    blocktrail.CREATE_WALLET_PROGRESS_BACKUP,
                    blocktrail.CREATE_WALLET_PROGRESS_SUBMIT,
                    blocktrail.CREATE_WALLET_PROGRESS_INIT,
                    blocktrail.CREATE_WALLET_PROGRESS_DONE
                ]);

                cb();
            }
        ).progress(function(p) { progress.push(p); });
    });

    it("should lock", function(cb) {
        assert(!wallet.locked);
        wallet.lock();
        assert(wallet.locked);
        cb();
    });

    it("should init", function(cb) {
        client.initWallet({
            identifier: myIdentifier,
            readOnly: true
        }, function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);
            assert.equal(wallet.walletVersion, 'v1');

            wallet = _wallet;

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

    it("should unlock", function(cb) {
        wallet.unlock({password: "password"}, function(err) {
            assert.ifError(err);

            cb();
        });
    });

    it("shouldn't be able to password change", function(cb) {
        wallet.passwordChange("password2", function(err) {
            assert.ok(!!err && err.message.match(/version does not support/));

            cb();
        });
    });
});

describe('test new blank wallet, old syntax', function() {
    var myIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');
    var wallet;

    after(function(cb) {
        if (wallet) {
            wallet.deleteWallet(true, function(err, result) {
                cb();
            });
        } else {
            cb();
        }
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

describe('test new wallet, without mnemonics', function() {
    var myIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');
    var wallet;

    var primarySeed = bip39.mnemonicToSeed(bip39.generateMnemonic(512), "password");
    var backupPrivateKey = bitcoin.HDNode.fromSeedBuffer(bip39.mnemonicToSeed(bip39.generateMnemonic(512), ""), bitcoin.networks.testnet);
    var backupPublicKey = backupPrivateKey.neutered();

    after(function(cb) {
        if (wallet) {
            wallet.deleteWallet(true, function(err, result) {
                cb();
            });
        } else {
            cb();
        }
    });

    it("shouldn't already exist", function(cb) {
        client.initWallet({
            identifier: myIdentifier
        }, function(err, wallet) {
            assert.ok(err);
            assert.ok(!wallet, "wallet with random ID [" + myIdentifier + "] already exists...");

            cb();
        });
    });

    it("should be created", function(cb) {
        client.createNewWallet({
                identifier: myIdentifier,
                primarySeed: primarySeed,
                backupPublicKey: backupPublicKey,
                keyIndex: 9999
            }, function(err, _wallet) {
                assert.ifError(err);
                assert.ok(_wallet);

                wallet = _wallet;

                assert.equal(wallet.identifier, myIdentifier);
                assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
                cb();
            }
        );
    });

    it("should be initializable", function(cb) {
        client.initWallet({
                identifier: myIdentifier,
                primarySeed: primarySeed,
                keyIndex: 9999
            }, function(err, _wallet) {
                assert.ifError(err);
                assert.ok(_wallet);

                wallet = _wallet;

                cb();
            }
        );
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
        client.initWallet({
            identifier: "unittest-transaction",
            passphrase: TRANSACTION_TEST_WALLET_PASSWORD
        }, function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            wallet = _wallet;

            assert.equal(wallet.primaryMnemonic, "give pause forget seed dance crawl situate hole keen");
            assert.equal(wallet.identifier, "unittest-transaction");
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

    it("should return errors when expected", function(cb) {
        async.parallel([
            function(cb) {
                wallet.pay({"": blocktrail.toSatoshi(0.001)}, function(err) {
                    assert.ok(!!err);
                    assert.equal(err.message, "Invalid address [] (Invalid checksum)");
                    assert.ok(err instanceof blocktrail.InvalidAddressError);

                    cb();
                });
            },
            function(cb) {
                wallet.pay({"2N65RcfKHiKQcPGZAA2QVeqitJvAQ8HroHA": blocktrail.toSatoshi(0.001)}, function(err) {
                    assert.ok(!!err);
                    assert.equal(err.message, "Invalid address [2N65RcfKHiKQcPGZAA2QVeqitJvAQ8HroHA] (Invalid checksum)");
                    assert.ok(err instanceof blocktrail.InvalidAddressError);

                    cb();
                });
            },
            function(cb) {
                wallet.pay({"2N65RcfKHiKQcPGZAA2QVeqitJvAQ8HroHD": 1}, function(err) {
                    assert.ok(!!err);
                    assert.equal(err.message, "Values should be more than dust (" + blocktrail.DUST + ")");
                    assert.ok(err instanceof blocktrail.WalletSendError);

                    cb();
                });
            },
            function(cb) {
                wallet.pay({"2N65RcfKHiKQcPGZAA2QVeqitJvAQ8HroHD": 0}, function(err) {
                    assert.ok(!!err);
                    assert.equal(err.message, "Values should be non zero");
                    assert.ok(err instanceof blocktrail.WalletSendError);

                    cb();
                });
            },
            function(cb) {
                wallet.pay({"2N65RcfKHiKQcPGZAA2QVeqitJvAQ8HroHD": 1.1}, function(err) {
                    assert.ok(!!err);
                    assert.equal(err.message, "Values should be in Satoshis");
                    assert.ok(err instanceof blocktrail.WalletSendError);

                    cb();
                });
            }
        ], cb);
    });

    it("change should be randomized when building a transaction", function(cb) {
        wallet.getNewAddress(function(err, address, path) {
            assert.ifError(err);
            assert.ok(path.indexOf("M/9999'/0/") === 0);
            assert.ok(bitcoin.Address.fromBase58Check(address));

            var pay = {};
            pay[address] = blocktrail.toSatoshi(0.001);

            var changeIdxs = [];
            var tryX = 10;

            async.whilst(
                function() { return tryX-- > 0 && _.uniq(changeIdxs).length < 2; },
                function(cb) {
                    wallet.buildTransaction(pay, function(err, tx, utxos) {
                        assert.ifError(err);

                        tx.outs.forEach(function(output, idx) {
                            var addr = bitcoin.Address.fromOutputScript(output.script, client.testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin).toBase58Check();

                            if (addr !== address) {
                                changeIdxs.push(idx);
                            }
                        });

                        cb();
                    });
                },
                function() {
                    assert(_.uniq(changeIdxs).length > 1);

                    cb();
                }
            );
        });

        it("should be able to build a transaction", function(cb) {
            wallet.getNewAddress(function(err, address, path) {
                assert.ifError(err);
                assert.ok(path.indexOf("M/9999'/0/") === 0);
                assert.ok(bitcoin.Address.fromBase58Check(address));

                var pay = {};
                pay[address] = blocktrail.toSatoshi(0.001);

                wallet.buildTransaction(pay, function(err, tx, utxos) {
                    assert.ifError(err);
                    assert.ok(tx);
                    assert.ok(tx.toHex());
                });
            });
        });
    });

    it("should be able to do a payment", function(cb) {
        wallet.getNewAddress(function(err, address, path) {
            assert.ifError(err);
            assert.ok(path.indexOf("M/9999'/0/") === 0);
            assert.ok(bitcoin.Address.fromBase58Check(address));

            var pay = {};
            pay[address] = blocktrail.toSatoshi(0.001);

            var progress = [];

            wallet.pay(pay, function(err, txHash) {
                assert.ifError(err);
                assert.ok(txHash);

                // change address doesn't always happen ...
                if (progress.indexOf(blocktrail.Wallet.PAY_PROGRESS_CHANGE_ADDRESS) === -1) {
                    progress.splice(2, 0, blocktrail.Wallet.PAY_PROGRESS_CHANGE_ADDRESS);
                }

                assert.deepEqual(progress, [
                    blocktrail.Wallet.PAY_PROGRESS_START,
                    blocktrail.Wallet.PAY_PROGRESS_COIN_SELECTION,
                    blocktrail.Wallet.PAY_PROGRESS_CHANGE_ADDRESS,
                    blocktrail.Wallet.PAY_PROGRESS_SIGN,
                    blocktrail.Wallet.PAY_PROGRESS_SEND,
                    blocktrail.Wallet.PAY_PROGRESS_DONE
                ]);

                // 200ms timeout, for w/e this is neccesary now ... @TODO: figure out why ...
                setTimeout(function() {
                    client.transaction(txHash, function(err, tx) {
                        assert.ifError(err);
                        assert.ok(tx);

                        cb();
                    });
                }, 200);
            }).progress(function(_progress) {
                progress.push(_progress);
            });
        });
    });
});

describe('test wallet, do transaction, without mnemonics', function() {
    var wallet;

    var primarySeed = bip39.mnemonicToSeed(TRANSACTION_TEST_WALLET_PRIMARY_MNEMONIC, TRANSACTION_TEST_WALLET_PASSWORD);

    it("should exists", function(cb) {
        client.initWallet({
                identifier: "unittest-transaction",
                primarySeed: primarySeed,
                primaryMnemonic: false // explicitly set false because we're reusing unittest-transaction which has a mnemonic stored
            }, function(err, _wallet) {
                assert.ifError(err);
                assert.ok(_wallet);

                wallet = _wallet;

                assert.equal(wallet.identifier, "unittest-transaction");
                assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
                cb();
            }
        );
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

                // 200ms timeout, for w/e this is neccesary now ... @TODO: figure out why ...
                setTimeout(function() {
                    client.transaction(txHash, function(err, tx) {
                        assert.ifError(err);
                        assert.ok(tx);

                        cb();
                    });
                }, 200);
            });
        });
    });
});

describe('test wallet, do opreturn transaction', function() {
    var wallet;

    it("should exists", function(cb) {
        client.initWallet({
            identifier: "unittest-transaction",
            passphrase: TRANSACTION_TEST_WALLET_PASSWORD
        }, function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            wallet = _wallet;

            assert.equal(wallet.primaryMnemonic, "give pause forget seed dance crawl situate hole keen");
            assert.equal(wallet.identifier, "unittest-transaction");
            assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            cb();
        });
    });

    it("should be able to do a payment with opreturn output", function(cb) {
        wallet.getNewAddress(function(err, address, path) {
            assert.ifError(err);

            var pay = {};
            pay[address] = blocktrail.toSatoshi(0.001);
            pay[blocktrail.Wallet.OP_RETURN] = "BLOCKTRAILTESTDATA";

            wallet.pay(pay, function(err, txHash) {
                assert.ifError(err);
                assert.ok(txHash);


                // 200ms timeout, for w/e this is neccesary now ... @TODO: figure out why ...
                setTimeout(function() {
                    client.transaction(txHash, function(err, tx) {
                        assert.ifError(err);
                        assert.ok(tx);

                        var hasOpreturn;
                        tx.outputs.forEach(function(output) {
                            if (output.type === 'op_return') {
                                hasOpreturn = true;

                                assert.equal(output.script_hex, "6a12424c4f434b545241494c5445535444415441");
                            }
                        });
                        assert.ok(hasOpreturn);

                        cb();
                    });
                }, 200);
            });
        });
    });
});

describe('test wallet, do forcefee transaction', function() {
    var wallet;

    it("should exists", function(cb) {
        client.initWallet({
            identifier: "unittest-transaction",
            passphrase: TRANSACTION_TEST_WALLET_PASSWORD
        }, function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            wallet = _wallet;

            assert.equal(wallet.primaryMnemonic, "give pause forget seed dance crawl situate hole keen");
            assert.equal(wallet.identifier, "unittest-transaction");
            assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            cb();
        });
    });

    it("should be able to do a payment with forced fee", function(cb) {
        wallet.getNewAddress(function(err, address, path) {
            assert.ifError(err);

            var pay = {};
            pay[address] = blocktrail.toSatoshi(0.01);
            var forceFee = blocktrail.toSatoshi(0.00054321);

            wallet.pay(pay, null, false, true, blocktrail.Wallet.FEE_STRATEGY_FORCE_FEE, null, {
                forcefee: forceFee,
                checkFee: false
            }, function(err, txHash) {
                assert.ifError(err);
                assert.ok(txHash);

                // 200ms timeout, for w/e this is neccesary now ... @TODO: figure out why ...
                setTimeout(function() {
                    client.transaction(txHash, function(err, tx) {
                        assert.ifError(err);
                        // this could very occasionally fail if change < DUST because then it's added to fee, so adjusted check for that
                        assert.ok(tx['total_fee'] >= forceFee && tx['total_fee'] <= forceFee + blocktrail.DUST,
                            "fee [" + tx['total_fee'] + "] should be equal to forced fee [" +  forceFee + "] for tx [" + txHash + "]");

                        cb();
                    });
                }, 200);
            });
        });
    });
});

describe('test wallet discovery and upgrade key index', function() {
    var myIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');
    var wallet;

    after(function(cb) {
        if (wallet) {
            wallet.deleteWallet(true, function(err, result) {
                cb();
            });
        } else {
            cb();
        }
    });

    it("should be created", function(cb) {
        createDiscoveryTestWallet(myIdentifier, "password", function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            wallet = _wallet;

            assert.equal(wallet.primaryMnemonic, "give pause forget seed dance crawl situate hole kingdom");
            assert.equal(wallet.identifier, myIdentifier);
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
            }
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
        // set upgrade
        wallet.upgradeToKeyIndex = 10000;
        // lock
        wallet.lock();
        // unlock should upgrade
        wallet.unlock({
            passphrase: "password"
        }).then(function() {
            assert.equal(wallet.getBlocktrailPublicKey("M/10000'").toBase58(), "tpubD9m9hziKhYQExWgzMUNXdYMNUtourv96sjTUS9jJKdo3EDJAnCBJooMPm6vGSmkNTNAmVt988dzNfNY12YYzk9E6PkA7JbxYeZBFy4XAaCp");

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
        if (wallet) {
            wallet.deleteWallet(true, function(err, result) {
                cb();
            });
        } else {
            cb();
        }
    });

    it("should be created", function(cb) {
        createDiscoveryTestWallet(myIdentifier, "badpassword", function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            wallet = _wallet;

            assert.equal(wallet.primaryMnemonic, "give pause forget seed dance crawl situate hole kingdom");
            assert.equal(wallet.identifier, myIdentifier);
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
            assert.ok(confirmed + unconfirmed === 0);

            cb();
        });
    });
});

describe('test wallet webhook', function() {
    // this.timeout(0); // disable, can take long

    var myIdentifier = "nodejs-sdk-" + crypto.randomBytes(24).toString('hex');
    var wallet;

    after(function(cb) {
        if (wallet) {
            wallet.deleteWallet(true, function(err, result) {
                cb();
            });
        } else {
            cb();
        }
    });

    it("shouldn't already exist", function(cb) {
        client.initWallet({
            identifier: myIdentifier,
            passphrase: "password"
        }, function(err, wallet) {
            assert.ok(err);
            assert.ok(!wallet, "wallet with random ID [" + myIdentifier + "] already exists...");

            cb();
        });
    });

    it("should be created", function(cb) {
        client.createNewWallet({
            identifier: myIdentifier,
            passphrase: "password",
            keyIndex: 9999
        }, function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            wallet = _wallet;

            assert.equal(wallet.identifier, myIdentifier);
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
                                assert.ok(_.includes(_.map(result['data'], 'address'), address1));

                                wallet.getNewAddress(function(err, address2) {
                                    assert.ifError(err);

                                    client.getWebhookEvents(myWebhookIdentifier, function(err, result) {
                                        assert.ifError(err);
                                        assert.ok(_.includes(_.map(result['data'], 'address'), address2));

                                        wallet.deleteWallet(function(err, result) {
                                            assert.ifError(err);
                                            assert.ok(result);

                                            client.deleteWebhook(myWebhookIdentifier, function(err, result) {
                                                assert.ok(err);

                                                cb();
                                            });
                                        });
                                    });
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
        client.initWallet({
            identifier: "unittest-transaction",
            passphrase: "password"
        }, function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            wallet = _wallet;

            client.allWallets({page: 1}, function(err, wallets) {
                assert.ifError(err);

                assert.ok(wallets['data'].length > 0);

                assert.equal(wallet.primaryMnemonic, "give pause forget seed dance crawl situate hole keen");
                assert.equal(wallet.identifier, "unittest-transaction");
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
            assert.ok(transactions['data'].length === 23);
            assert.ok(transactions['data'][0]['hash'], "2cb21783635a5f22e9934b8c3262146b42d251dfb14ee961d120936a6c40fe89");

            cb();
        });
    });

    it("should list expected addresses", function(cb) {
        wallet.addresses({page: 1, limit: 23}, function(err, addresses) {
            assert.ifError(err);
            assert.ok(addresses['data']);
            assert.ok(addresses['total']);
            assert.ok(addresses['data'].length === 23);
            assert.ok(addresses['data'][0]['address'], "2MzyKviSL6pnWxkbHV7ecFRE3hWKfzmT8WS");

            cb();
        });
    });

    it("should list UTXOs", function(cb) {
        wallet.utxos({page: 0, limit: 23}, function(err, addresses) {
            assert.ifError(err);
            assert.ok(addresses['data']);
            assert.ok(addresses['total']);
            assert.ok(addresses['data'].length === 23);

            cb();
        });
    });
});

describe("size estimation", function() {

    it("should estimate proper size for 1 input 1 output TX", function() {
        var txb = new bitcoin.TransactionBuilder();
        txb.addInput('0000000000000000000000000000000000000000000000000000000000000000', 0);
        txb.addOutput('2MzyKviSL6pnWxkbHV7ecFRE3hWKfzmT8WS', 1);

        assert.equal(347, blocktrail.Wallet.estimateIncompleteTxSize(txb.buildIncomplete()));
    });

    it("should estimate proper size for 99 inputs 1 output TX", function() {
        var txb = new bitcoin.TransactionBuilder();
        for (var i = 0; i < 99; i++) {
            txb.addInput('0000000000000000000000000000000000000000000000000000000000000000', i);
        }
        txb.addOutput('2MzyKviSL6pnWxkbHV7ecFRE3hWKfzmT8WS', 1);

        assert.equal(29453, blocktrail.Wallet.estimateIncompleteTxSize(txb.buildIncomplete()));
    });

    it("should estimate proper size for 1 input 99 outputs TX", function() {
        var txb = new bitcoin.TransactionBuilder();
        txb.addInput('0000000000000000000000000000000000000000000000000000000000000000', 0);
        for (var i = 0; i < 99; i++) {
            txb.addOutput('2MzyKviSL6pnWxkbHV7ecFRE3hWKfzmT8WS', 1);
        }

        assert.equal(3679, blocktrail.Wallet.estimateIncompleteTxSize(txb.buildIncomplete()));
    });
});

describe("APIClient", function() {
    it("resolvePrimaryPrivateKeyFromOptions", function(cb) {
        client.resolvePrimaryPrivateKeyFromOptions({
            passphrase: "password",
            primaryMnemonic: "give pause forget seed dance crawl situate hole keen"
        }, function(err, options) {
            assert.ifError(err);
            assert.ok(options.primaryPrivateKey);
            assert.ok(options.primaryPrivateKey instanceof bitcoin.HDNode);
            assert.equal("tprv8ZgxMBicQKsPeR93md5eVTbLDgQ8kfV4CDNtrVXv5p29KXtx7VHKFQThGkFgC61sYeeeaVH1yFv4thcvxS9cYdFrYwTNmkGhkQEJycSzAhE", options.primaryPrivateKey.toBase58());

            cb();

        });
    });
});
