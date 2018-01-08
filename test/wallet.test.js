/* jshint -W101, -W098 */
/* global window */
var _ = require('lodash');
var blocktrail = require('../');
var Wallet = blocktrail.Wallet;
var assert = require('assert');
var crypto = require('crypto');
var async = require('async');
var bitcoin = require('bitcoinjs-lib');
var bip39 = require("bip39");

var WAIT_FOR_TX_PROCESSED = process.env.BLOCKTRAIL_WAIT_FOR_TX || 300;

/**
 *
 * @param network
 * @param testnet
 * @returns {*}
 * @private
 */
function _createApiClient(network, testnet) {
    return blocktrail.BlocktrailSDK({
        apiKey : process.env.BLOCKTRAIL_SDK_APIKEY || window.BLOCKTRAIL_SDK_APIKEY || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APIKEY",
        apiSecret : process.env.BLOCKTRAIL_SDK_APISECRET || window.BLOCKTRAIL_SDK_APISECRET || "EXAMPLE_BLOCKTRAIL_SDK_NODEJS_APISECRET",
        network: network,
        testnet : testnet
    });
}

/**
 * @type APIClient
 */
var client = _createApiClient("BTC", true);

var TRANSACTION_TEST_WALLET_PRIMARY_MNEMONIC = "give pause forget seed dance crawl situate hole keen",
    TRANSACTION_TEST_WALLET_BACKUP_MNEMONIC = "give pause forget seed dance crawl situate hole give",
    TRANSACTION_TEST_WALLET_PASSWORD = "password";

var _createTestWallet = function(identifier, passphrase, primaryMnemonic, backupMnemonic, segwit, cb) {
    var keyIndex = 9999;
    var network = client.testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

    var primarySeed = bip39.mnemonicToSeed(primaryMnemonic, passphrase);
    var primaryPrivateKey = bitcoin.HDNode.fromSeedBuffer(primarySeed, network);

    var backupSeed = bip39.mnemonicToSeed(backupMnemonic, "");
    var backupPrivateKey = bitcoin.HDNode.fromSeedBuffer(backupSeed, network);
    var backupPublicKey = backupPrivateKey.neutered();

    var checksum = primaryPrivateKey.getAddress();
    var primaryPublicKey = primaryPrivateKey.deriveHardened(keyIndex).neutered();

    client.storeNewWalletV1(
        identifier,
        [primaryPublicKey.toBase58(), "M/" + keyIndex + "'"],
        [backupPublicKey.toBase58(), "M"],
        primaryMnemonic,
        checksum,
        keyIndex,
        segwit
    ).then(function(result) {
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
            result.segwit || 0,
            client.testnet,
            checksum
        );

        wallet.unlock({
            passphrase: passphrase
        }, function(err) {
            cb(err, wallet);
        });

    }, function(err) {
        return cb(err);
    });
};

var createDiscoveryTestWallet = function(identifier, passphrase, cb) {
    var primaryMnemonic = "give pause forget seed dance crawl situate hole kingdom";
    var backupMnemonic = "give pause forget seed dance crawl situate hole course";

    return _createTestWallet(identifier, passphrase, primaryMnemonic, backupMnemonic, false, cb);
};

var createTransactionTestWallet = function(identifier, segwit, cb) {
    return _createTestWallet(
        identifier,
        TRANSACTION_TEST_WALLET_PASSWORD,
        TRANSACTION_TEST_WALLET_PRIMARY_MNEMONIC,
        TRANSACTION_TEST_WALLET_BACKUP_MNEMONIC,
        segwit,
        cb
    );
};

var createRecoveryTestWallet = function(identifier, passphrase, cb) {
    var primaryMnemonic = "give pause forget seed dance crawl situate hole join";
    var backupMnemonic = "give pause forget seed dance crawl situate hole crater";

    return _createTestWallet(identifier, passphrase, primaryMnemonic, backupMnemonic, false, cb);
};

describe('Initialize with check_backup_key', function() {
    it('rejects invalid inputs', function(cb) {
        try {
            client.initWallet({
                identifier: "unittest-transaction",
                password: "password",
                check_backup_key: []
            });
            assert(false);
        } catch (e) {
            assert.equal("Invalid input, must provide the backup key as a string (the xpub)", e.message);
        }
        cb();
    });

    it('checks against the string', function(cb) {
        client.initWallet({
            identifier: "unittest-transaction",
            password: "password",
            check_backup_key: 'for demonstration purposes only'
        }, function(err, _wallet) {
            assert.ok(err);
            assert.equal("Backup key returned from server didn't match our own copy", err.message);
            cb();
        });
    });

    it('allows if the backup key matches', function(cb) {
        // You wouldn't keep your backup seed in your code,
        // dump it from the wallet upon generation

        var backupSeed = bip39.mnemonicToSeed(TRANSACTION_TEST_WALLET_BACKUP_MNEMONIC, "");
        var backupPrivateKey = bitcoin.HDNode.fromSeedBuffer(backupSeed, bitcoin.networks.testnet);
        var backupPublicKey = backupPrivateKey.neutered();
        var xpub = backupPublicKey.toBase58();

        // Would be saves as a string in code..
        client.initWallet({
            identifier: "unittest-transaction",
            password: "password",
            check_backup_key: xpub
        }, function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);
            cb();
        });
    });
});

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

        [
            ['', 'string'],
            [false, 'string'],
            [true, 'boolean']
        ].map(function(fixture) {
            var invalidInput = fixture[0];
            var type = fixture[1];
            it('refuses to derive with invalid chain index variable ' + type, function(cb) {
                wallet.getNewAddress(invalidInput, function(err, res) {
                    assert.ok(!!err && err.message.match(/chain index/));
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
                assert.ok(!_wallet.isSegwit());
                assert.equal(blocktrail.Wallet.CHAIN_BTC_DEFAULT, _wallet.chain);

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
                assert.ok(!_wallet.isSegwit());
                assert.equal(blocktrail.Wallet.CHAIN_BTC_DEFAULT, _wallet.chain);

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

describe('test wallet, bitcoin cash mirror', function() {
    var tbccClient = _createApiClient("BCC", true);

    [
        {useCashAddress: false, addressType: "base58", description: "false uses base58 address"},
        {useCashAddress: true,  addressType: "cashaddr", description: "can opt into cash address"}

    ].map(function(fixture) {
        var useCashAddress = fixture.useCashAddress;
        var expectType = fixture.addressType;
        var description = fixture.description;

        var wallet;
        var address;

        it(description, function(cb) {
            tbccClient.initWallet({
                identifier: "unittest-transaction",
                passphrase: TRANSACTION_TEST_WALLET_PASSWORD,
                useCashAddress: useCashAddress
            }, function(err, _wallet) {
                assert.ifError(err);
                assert.ok(_wallet);
                assert.ok(!_wallet.isSegwit());
                assert.equal(_wallet.chain, blocktrail.Wallet.CHAIN_BCC_DEFAULT);
                wallet = _wallet;

                assert.equal(useCashAddress, _wallet.useNewCashAddr);
                assert.equal(wallet.primaryMnemonic, "give pause forget seed dance crawl situate hole keen");
                assert.equal(wallet.identifier, "unittest-transaction");
                assert.equal(wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
                cb();
            });
        });

        it("derives the right address (" + description + ")", function(cb) {
            wallet.getNewAddress(function(err, serverAddress, path) {
                assert.ifError(err);
                assert.ok(serverAddress);
                assert.ok(path);

                var decoded = wallet.decodeAddress(serverAddress);
                assert.ok(decoded);
                assert.equal(serverAddress, decoded.address);
                assert.equal(expectType, decoded.type);

                address = serverAddress;
                cb();
            });
        });

        it("can coin select address (" + expectType + ")", function(cb) {
            var pay = {};
            pay[address] = 12345;
            wallet.coinSelection(pay, function(err, utxos) {
                assert.ifError(err);
                assert.ok(utxos);
                assert.ok(utxos.length > 0);

                cb();
            });
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
            assert.ok(!_wallet.isSegwit());
            assert.equal(blocktrail.Wallet.CHAIN_BTC_DEFAULT, _wallet.chain);
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

    it("should be able to build a transaction paying a bech32 address", function(cb) {
        var address = "tb1qn08f8x0eamw66enrt497zu0v3u2danzey6asqs";
        var wp = "00149bce9399f9eeddad66635d4be171ec8f14decc59";
        var pay = {};
        pay[address] = blocktrail.toSatoshi(0.001);

        wallet.buildTransaction(pay, null, false, false, function(err, tx, utxos) {
            assert.ifError(err);
            assert.ok(tx);
            assert.ok(tx.toHex());
            assert.equal(wp, tx.outs[0].script.toString('hex'));
            cb();
        });
    });

    it("change should be randomized when building a transaction", function(cb) {
        wallet.getNewAddress(function(err, address, path) {
            assert.ifError(err);
            assert.ok(path.indexOf("M/9999'/0/") === 0);
            assert.ok(bitcoin.address.fromBase58Check(address));

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
                            var addr = bitcoin.address.fromOutputScript(output.script, client.testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin);

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
                assert.ok(bitcoin.address.fromBase58Check(address));

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
            assert.ok(path.indexOf("M/9999'/", wallet.chain, "/") === 0);
            assert.ok(bitcoin.address.fromBase58Check(address));

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
                }, WAIT_FOR_TX_PROCESSED);
            }).progress(function(_progress) {
                progress.push(_progress);
            });
        });
    });
});

describe('test wallet with segwit chain', function() {
    var wallet;

    it("should exist and be setup", function(cb) {
        client.initWallet({
            identifier: "unittest-transaction-sw",
            passphrase: TRANSACTION_TEST_WALLET_PASSWORD
        }, function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);
            assert.equal(_wallet.primaryMnemonic, "give pause forget seed dance crawl situate hole keen");
            assert.equal(_wallet.identifier, "unittest-transaction-sw");
            assert.equal(_wallet.getBlocktrailPublicKey("M/9999'").toBase58(), "tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ");
            assert.ok(_wallet.isSegwit());
            assert.equal(blocktrail.Wallet.CHAIN_BTC_DEFAULT, _wallet.chain);
            assert.equal(blocktrail.Wallet.CHAIN_BTC_SEGWIT, _wallet.changeChain);

            wallet = _wallet;
            cb();
        });
    });

    it("getNewAddress produces plain P2SH addresses", function(cb) {
        wallet.getNewAddress(function(err, address, path) {
            assert.ifError(err);
            assert.ok(path.indexOf("M/9999'/0/") === 0);

            assert.ok(bitcoin.address.fromBase58Check(address));

            cb();
        });
    });

    it("getNewAddress produces segwit P2SH addresses for change chain", function(cb) {
        wallet.getNewAddress(wallet.changeChain, function(err, address, path) {
            assert.ifError(err);
            assert.ok(path.indexOf("M/9999'/2/") === 0);

            assert.ok(bitcoin.address.fromBase58Check(address));

            cb();
        });
    });

    it("getWalletScriptByPath produces P2SH addresses, and returns witnessScript", function(cb) {
        var eAddress = "2N3j4Vx3D9LPumjtRbRe2RJpwVocvCCkHKh";

        assert.equal(wallet.getAddressByPath("M/9999'/2/0"), eAddress);

        var walletScript = wallet.getWalletScriptByPath("M/9999'/2/0");
        assert.equal(walletScript.address, eAddress);
        assert.ok(walletScript.witnessScript);
        assert.ok(walletScript.redeemScript);
        cb();
    });
});

describe('test wallet, do transaction, segwit spend', function() {
    var wallets = [];
    after(function(cb) {
        if (wallets.length > 0) {
            wallets.map(function(wallet) {
                wallet.deleteWallet(true);
            });
        }
        cb();
    });

    var unitTestWallet;
    var identifier = crypto.randomBytes(12).toString('hex');
    var segwitWallet;
    var receiveAddr;
    var receiveBackAddr;
    it("should setup the funding wallet", function(cb) {
        client.initWallet({
            identifier: "unittest-transaction",
            passphrase: TRANSACTION_TEST_WALLET_PASSWORD
        }, function(err, _wallet) {
            assert.ifError(err);
            assert.ok(_wallet);

            _wallet.getNewAddress(function(err, address, path) {
                assert.ifError(err);
                assert.ok(address);
                assert.ok(path);

                unitTestWallet = _wallet;
                receiveBackAddr = address;
                cb();
            });
        });
    });

    it("should make the receiving segwit wallet", function(cb) {
        createTransactionTestWallet(identifier, true, function(err, newWallet) {
            wallets.push(newWallet);
            assert.ifError(err);
            newWallet.getNewAddress(newWallet.changeChain, function(err, address, path) {
                assert.ifError(err);
                assert.ok(bitcoin.address.fromBase58Check(address));
                assert.ok(newWallet.isSegwit());
                assert.ok(path.indexOf("M/9999'/2/") === 0);

                var checkScript = newWallet.getWalletScriptByPath(path);
                assert.ok(checkScript.address = address);
                assert.ok(checkScript.redeemScript instanceof Buffer);
                assert.ok(checkScript.witnessScript instanceof Buffer);

                segwitWallet = newWallet;
                receiveAddr = address;
                cb();
            });
        });
    });

    var paymentHash;
    it("should receive funds from unitTestWallet", function(cb) {
        var pay = {};
        pay[receiveAddr] = 30000;
        unitTestWallet.pay(pay, null, true, function(err, txid) {
            assert.ifError(err);
            assert.ok(txid);
            paymentHash = txid;
            cb();
        });
    });

    it("should return to unitTestWallet", function(cb) {
        var pay = {};
        pay[receiveBackAddr] = 20000;
        segwitWallet.pay(pay, null, true, function(err, txid) {
            assert.ifError(err);
            assert.ok(txid);

            setTimeout(function() {
                client.transaction(txid, function(err, tx) {
                    assert.ifError(err);
                    assert.ok(tx);
                    cb();
                });
            }, WAIT_FOR_TX_PROCESSED);
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
            assert.ok(bitcoin.address.fromBase58Check(address));

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
                }, WAIT_FOR_TX_PROCESSED);
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
                }, WAIT_FOR_TX_PROCESSED);
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
                }, WAIT_FOR_TX_PROCESSED);
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
            _wallet.chain = blocktrail.Wallet.CHAIN_BTC_DEFAULT;
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

            _wallet.chain = blocktrail.Wallet.CHAIN_BTC_DEFAULT;
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

describe("Wallet.getAddressAndType", function() {
    var fixtures = [
        {
            address: "tb1qn08f8x0eamw66enrt497zu0v3u2danzey6asqs",
            network: bitcoin.networks.testnet,
            type: "bech32",
            valid: true
        },
        {
            address: "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7",
            network: bitcoin.networks.testnet,
            type: "bech32",
            valid: true
        },
        {
            address: "muinVykhtZyonxQxk8zBptX6Lmri91bdNG",
            network: bitcoin.networks.testnet,
            type: "base58",
            valid: true
        },
        {
            address: "2N7T4CD6CEuNHJoGKpoJH3YexqektXjyy6L",
            network: bitcoin.networks.testnet,
            type: "base58",
            valid: true
        },
        {
            address: "16uf9UUBbUHdVAnETGZQnvXZcf9NPU1QR6",
            network: bitcoin.networks.bitcoin,
            type: "base58",
            valid: true
        },
        {
            address: "3CgSFohdEqd7pSxbDAJeJo6X5Qm2tBbby9",
            network: bitcoin.networks.bitcoin,
            type: "base58",
            valid: true
        },
        {
            address: "bc1qqy36hngpyw4u6qfr40xszgate5qj827dqy36hngpyw4u6qfr40xsp3an42",
            network: bitcoin.networks.bitcoin,
            type: "bech32",
            valid: true
        },
        {
            address: "bc1qn08f8x0eamw66enrt497zu0v3u2danzewuxrmr",
            network: bitcoin.networks.bitcoin,
            type: "bech32",
            valid: true
        },
        {
            address: "16uf9UUBbUHdVAnETGZQnvXZcf9NPU1QR6",
            network: bitcoin.networks.testnet,
            type: "base58",
            error: "Address invalid on this network",
            valid: false
        },
        {
            address: "3CgSFohdEqd7pSxbDAJeJo6X5Qm2tBbby9",
            network: bitcoin.networks.testnet,
            type: "base58",
            error: "Address invalid on this network",
            valid: false
        },
        {
            address: "bc1qqy36hngpyw4u6qfr40xszgate5qj827dqy36hngpyw4u6qfr40xsp3an42",
            network: bitcoin.networks.testnet,
            type: "bech32",
            error: "Address invalid on this network",
            valid: false
        },
        {
            address: "bc1qn08f8x0eamw66enrt497zu0v3u2danzewuxrmr",
            network: bitcoin.networks.testnet,
            type: "bech32",
            error: "Address invalid on this network",
            valid: false
        },
        {
            address: "bc1qqy36hngpyw4u6qfr40xszgate5qj827dqy36hngpyw4u6qfr40xsp3an42",
            network: bitcoin.networks.bitcoincash,
            error: "Non-base58 character",
            type: "bech32",
            valid: false
        },
        {
            address: "bc1qn08f8x0eamw66enrt497zu0v3u2danzewuxrmr",
            network: bitcoin.networks.bitcoincash,
            error: "Non-base58 character",
            type: "bech32",
            valid: false
        },
        {
            address: "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7",
            network: bitcoin.networks.bitcoincashtestnet,
            error: "Non-base58 character",
            type: "bech32",
            valid: false
        },
        {
            address: "tb1qn08f8x0eamw66enrt497zu0v3u2danzey6asqs",
            network: bitcoin.networks.bitcoincashtestnet,
            error: "Non-base58 character",
            type: "bech32",
            valid: false
        },
        {
            address: "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7",
            network: bitcoin.networks.bitcoin,
            error: "Address invalid on this network",
            type: "bech32",
            valid: false
        },
        {
            address: "tb1qn08f8x0eamw66enrt497zu0v3u2danzey6asqs",
            network: bitcoin.networks.bitcoin,
            error: "Address invalid on this network",
            type: "bech32",
            valid: false
        },
        {
            address: "bc1qqy36hngpyw4u6qfr40xszgate5qj827dqy36hngpyw4u6qfr40xsp3an42",
            network: bitcoin.networks.testnet,
            error: "Address invalid on this network",
            type: "bech32",
            valid: false
        },
        {
            address: "bc1qn08f8x0eamw66enrt497zu0v3u2danzewuxrmr",
            network: bitcoin.networks.testnet,
            error: "Address invalid on this network",
            type: "bech32",
            valid: false
        }
    ];

    fixtures.map(function(fixture) {
        var description =
            (fixture.valid ? "parses" : "fails to parse") +
            " a " + fixture.type + " address: " + fixture.address;

        it(description, function(cb) {
            var addrAndType;
            var err;
            try {
                addrAndType = Wallet.getAddressAndType(fixture.address, fixture.network);
            } catch (e) {
                err = e;
            }

            if (fixture.valid) {
                assert.ifError(err);
                assert.ok(Object.keys(addrAndType).indexOf("address") !== -1);
                assert.ok(Object.keys(addrAndType).indexOf("decoded") !== -1);
                assert.ok(Object.keys(addrAndType).indexOf("type") !== -1);
                assert.equal(addrAndType.type, fixture.type);
                assert.equal(addrAndType.address, fixture.address);
            } else {
                assert.ok(typeof err === "object");
                assert.ok(typeof addrAndType === "undefined");
                if (Object.keys(fixture).indexOf("error") !== -1) {
                    assert.equal(err.message, fixture.error);
                }
            }
            cb();
        });
    });
});

describe("Wallet.convertPayToOutputs", function() {
    var fixtures = [
        {
            description: "p2wpkh",
            network: bitcoin.networks.testnet,
            cashaddr: false,
            value: 12345,
            address: "tb1qn08f8x0eamw66enrt497zu0v3u2danzey6asqs",
            script: "00149bce9399f9eeddad66635d4be171ec8f14decc59"
        },
        {
            description: "p2wsh",
            network: bitcoin.networks.testnet,
            value: 12345,
            cashaddr: false,
            address: "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7",
            script: "00201863143c14c5166804bd19203356da136c985678cd4d27a1b8c6329604903262"
        },
        {
            description: "p2pkh",
            network: bitcoin.networks.testnet,
            value: 12345,
            cashaddr: false,
            address: "muinVykhtZyonxQxk8zBptX6Lmri91bdNG",
            script: "76a9149bce9399f9eeddad66635d4be171ec8f14decc5988ac"
        },
        {
            description: "p2sh",
            network: bitcoin.networks.testnet,
            value: 12345,
            cashaddr: false,
            address: "2N7T4CD6CEuNHJoGKpoJH3YexqektXjyy6L",
            script: "a9149bce9399f9eeddad66635d4be171ec8f14decc5987"
        },
        {
            description: "p2sh cashaddr",
            network: bitcoin.networks.bitcoincash,
            value: 12345,
            cashaddr: true,
            address: "bitcoincash:ppm2qsznhks23z7629mms6s4cwef74vcwvn0h829pq",
            script: "a91476a04053bda0a88bda5177b86a15c3b29f55987387"
        }
    ];

    fixtures.map(function(fixture) {
        var network = fixture.network;
        var payScriptOutputs = [{
            scriptPubKey: fixture.script,
            value: fixture.value
        }];
        var payAddressOutputs = [{
            address: fixture.address,
            value: fixture.value
        }];
        var payKeyedObject = {};
        payKeyedObject[fixture.address] = fixture.value;
        var payFlatArray = [
            [fixture.address, fixture.value]
        ];
        [
            {
                desc: "deals with script outputs",
                pay: payScriptOutputs
            },
            {
                desc: "deals with address outputs",
                pay: payAddressOutputs
            },
            {
                desc: "deals with object keyed by address",
                pay: payKeyedObject
            },
            {
                desc: "deals with a flat output array",
                pay: payFlatArray
            }
        ].map(function(f) {
            it(fixture.description + " converted to script, " + f.desc, function(cb) {
                var test = function(outputs) {
                    assert.ok(Array.isArray(outputs));
                    assert.equal(outputs[0].value, fixture.value);
                    assert.equal(outputs[0].scriptPubKey, fixture.script);
                    assert.equal(outputs[0].address, null);
                };

                // should accept some input of ours
                var outputs = Wallet.convertPayToOutputs(f.pay, network, fixture.cashaddr);
                test(outputs);

                // repeating the procedure should pass the same test
                var outputs2 = Wallet.convertPayToOutputs(outputs, network, fixture.cashaddr);
                test(outputs2);

                outputs.map(function(output, i) {
                    assert.equal(outputs[i].scriptPubKey, outputs2[i].scriptPubKey);
                    assert.equal(outputs[i].value, outputs2[i].value);
                });

                cb();
            });
        });
    });
});

describe('test wallet coin selection forms', function() {
    var wallet;

    it("BTC testnet wallet should exist", function(cb) {
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

    it("shouldnt coin select for wrong network", function(cb) {
        var pay = {};
        pay["bc1qqy36hngpyw4u6qfr40xszgate5qj827dqy36hngpyw4u6qfr40xsp3an42"] = 10000;
        wallet.coinSelection(pay, function(err, res) {
            assert.ok(err);
            cb();
        });
    });

    var fixtures = [
        {"tb1qn08f8x0eamw66enrt497zu0v3u2danzey6asqs": 10000},
        {"tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7": 10000},
        [
            {
                "address": "tb1qn08f8x0eamw66enrt497zu0v3u2danzey6asqs",
                "value": 10000
            },
            {
                "address": "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7",
                "value": 10000
            }
        ],
        [
            {
                "scriptPubKey": "00149bce9399f9eeddad66635d4be171ec8f14decc59",
                "value": 10000
            },
            {
                "address": "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7",
                "value": 10000
            }
        ]
    ];

    fixtures.map(function(fixture) {
        var type = "object";
        if (Array.isArray(fixture)) {
            type = "outputs array";
        }
        it("should coin select for " + type, function(cb) {
            wallet.coinSelection(fixture, false, function(err, res) {
                assert.ifError(err);
                cb();
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
        var txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
        txb.addInput('4200000000000000000000000000000000000000000000000000000000000000', 0);
        txb.addOutput('2MzyKviSL6pnWxkbHV7ecFRE3hWKfzmT8WS', 1);

        assert.equal(347, blocktrail.Wallet.estimateIncompleteTxSize(txb.buildIncomplete()));
    });

    it("should estimate proper size for 99 inputs 1 output TX", function() {
        var txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
        for (var i = 0; i < 99; i++) {
            txb.addInput('4200000000000000000000000000000000000000000000000000000000000000', i);
        }
        txb.addOutput('2MzyKviSL6pnWxkbHV7ecFRE3hWKfzmT8WS', 1);

        assert.equal(29453, blocktrail.Wallet.estimateIncompleteTxSize(txb.buildIncomplete()));
    });

    it("should estimate proper size for 1 input 99 outputs TX", function() {
        var txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
        txb.addInput('4200000000000000000000000000000000000000000000000000000000000000', 0);
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

describe("bitcoin cash address switching", function() {
    describe("APIClient.getLegacyBitcoinCashAddress", function() {
        describe("doesnt work with BTC", function() {
            it("fails", function(cb) {
                var tbtcNetwork = _createApiClient("BTC", true);
                var err;
                try {
                    tbtcNetwork.getLegacyBitcoinCashAddress("1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu");
                } catch (e) {
                    err = e;
                }

                assert.ok(err);
                assert.ok("Cash addresses only work on bitcoin cash" === err.message);
                cb();
            });
        });

        function testLegacyFromCashAddress(network, testnet, legacy, cash) {
            var bccNetwork = _createApiClient(network, testnet);

            it("returns base58 address if that was given", function(cb) {
                assert.ok(legacy === bccNetwork.getLegacyBitcoinCashAddress(legacy));
                cb();
            });
            it("returns legacy address for cashaddress", function(cb) {
                assert.ok(legacy === bccNetwork.getLegacyBitcoinCashAddress(cash));
                cb();
            });
        }

        describe ("works with BCC testnet (P2SH)", function() {
            testLegacyFromCashAddress("BCC", true, "2N44ThNe8NXHyv4bsX8AoVCXquBRW94Ls7W", "bchtest:ppm2qsznhks23z7629mms6s4cwef74vcwvhanqgjxu");
        });
        describe ("works with BCC (P2SH)", function() {
            testLegacyFromCashAddress("BCC", false, "3LDsS579y7sruadqu11beEJoTjdFiFCdX4", "bitcoincash:pr95sy3j9xwd2ap32xkykttr4cvcu7as4yc93ky28e");
        });
        describe ("works with BCC (P2PKH)", function() {
            testLegacyFromCashAddress("BCC", false, "1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu", "bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a");
        });
    });


    describe("APIClient.getCashAddressFromLegacyAddress", function() {
        describe("doesnt work with BTC", function() {
            it("fails", function(cb) {
                var tbtcNetwork = _createApiClient("BTC", true);
                var err;
                try {
                    tbtcNetwork.getCashAddressFromLegacyAddress("1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu");
                } catch (e) {
                    err = e;
                }

                assert.ok(err);
                assert.ok("Cash addresses only work on bitcoin cash" === err.message);
                cb();
            });
        });

        function testCashFromLegacyAddress(network, testnet, cash, legacy) {
            var bccNetwork = _createApiClient(network, testnet);

            it("returns cash address if that was given", function(cb) {
                assert.ok(cash === bccNetwork.getCashAddressFromLegacyAddress(cash));
                cb();
            });

            it("returns cash address for base58 address", function(cb) {
                assert.ok(cash === bccNetwork.getCashAddressFromLegacyAddress(legacy));
                cb();
            });
        }

        describe ("works with BCC testnet (P2SH)", function() {
            testCashFromLegacyAddress("BCC", true, "bchtest:ppm2qsznhks23z7629mms6s4cwef74vcwvhanqgjxu", "2N44ThNe8NXHyv4bsX8AoVCXquBRW94Ls7W");
        });

        describe ("works with BCC (P2SH)", function() {
            testCashFromLegacyAddress("BCC", false, "bitcoincash:pr95sy3j9xwd2ap32xkykttr4cvcu7as4yc93ky28e", "3LDsS579y7sruadqu11beEJoTjdFiFCdX4");
        });

        describe ("works with BCC (P2PKH)", function() {
            testCashFromLegacyAddress("BCC", false, "bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a", "1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu");
        });
    });

    var wallet;

    describe("wallet send", function() {
        /**
         * @type APIClient
         */
        var tbccClient = _createApiClient("BCC", true);
        var legacyAddress;
        var cashAddress;
        it("should exists", function(cb) {
            tbccClient.initWallet({
                identifier: "unittest-transaction",
                passphrase: "password",
                useCashAddress: true
            }, function(err, _wallet) {
                assert.ifError(err);
                assert.ok(_wallet);

                wallet = _wallet;
                cb();
            });
        });

        it("generates an address", function(cb) {
            wallet.getNewAddress(function(err, result) {
                assert.ifError(err);
                legacyAddress = tbccClient.getLegacyBitcoinCashAddress(result);
                cashAddress = result;
                cb();
            });
        });

        it("sends to legacy address", function(cb) {
            var pay = {};
            pay[legacyAddress] = 100000;
            wallet.pay(pay, null, false, false, function(err, result) {
                assert.ifError(err);
                cb();
            });
        });

        it("sends to casah address", function(cb) {
            var pay = {};
            pay[cashAddress] = 100000;
            wallet.pay(pay, null, false, false, function(err, result) {
                assert.ifError(err);
                cb();
            });
        });
    });
});
