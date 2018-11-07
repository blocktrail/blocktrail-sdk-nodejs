var _ = require('lodash');
var assert = require('assert');
var q = require('q');
var async = require('async');
var bitcoin = require('bitcoinjs-lib');
var bitcoinMessage = require('bitcoinjs-message');
var blocktrail = require('./blocktrail');
var CryptoJS = require('crypto-js');
var Encryption = require('./encryption');
var EncryptionMnemonic = require('./encryption_mnemonic');
var SizeEstimation = require('./size_estimation');
var bip39 = require('bip39');
var Wallet = require('./wallet');
var ethereumjs = require('ethereumjs-wallet')
var ethutil = require('ethereumjs-util')
var ethhdkey = require('ethereumjs-wallet/hdkey')
const ethtx = require('ethereumjs-tx')


var SignMode = {
    SIGN: "sign",
    DONT_SIGN: "dont_sign"
};

/**
 *
 * @param sdk                   APIClient       SDK instance used to do requests
 * @param identifier            string          identifier of the wallet
 * @param walletVersion         string
 * @param primaryMnemonic       string          primary mnemonic
 * @param encryptedPrimarySeed
 * @param encryptedSecret
 * @param primaryPublicKeys     string          primary mnemonic
 * @param backupPublicKey       string          BIP32 master pubKey M/
 * @param blocktrailPublicKeys  array           list of blocktrail pubKeys indexed by keyIndex
 * @param keyIndex              int             key index to use
 * @param segwit                int             segwit toggle from server
 * @param testnet               bool            testnet
 * @param regtest               bool            regtest
 * @param checksum              string
 * @param upgradeToKeyIndex     int
 * @param useNewCashAddr        bool            flag to opt in to bitcoin cash cashaddr's
 * @param bypassNewAddressCheck bool            flag to indicate if wallet should/shouldn't derive new address locally to verify api
 * @constructor
 * @internal
 */
var RskWallet = function(
    sdk,
    identifier,
    walletVersion,
    primaryMnemonic,
    encryptedPrimarySeed,
    encryptedSecret,
    primaryPublicKeys,
    keyIndex,
    segwit,
    testnet,
    regtest,
    checksum,
    upgradeToKeyIndex,
    useNewCashAddr,
    bypassNewAddressCheck
) {
    /* jshint -W071 */
    var self = this;

    self.sdk = sdk;
    self.identifier = identifier;
    self.walletVersion = walletVersion;
    self.locked = true;
    self.bypassNewAddressCheck = !!bypassNewAddressCheck;
    self.bitcoinCash = self.sdk.bitcoinCash;
    self.segwit = !!segwit;
    self.useNewCashAddr = !!useNewCashAddr;
    assert(!self.segwit || !self.bitcoinCash);

    self.testnet = testnet;
    self.regtest = regtest;
    if (self.bitcoinCash) {
        if (self.regtest) {
            self.network = bitcoin.networks.bitcoincashregtest;
        } else if (self.testnet) {
            self.network = bitcoin.networks.bitcoincashtestnet;
        } else {
            self.network = bitcoin.networks.bitcoincash;
        }
    } else {
        if (self.regtest) {
            self.network = bitcoin.networks.regtest;
        } else if (self.testnet) {
            self.network = bitcoin.networks.testnet;
        } else {
            self.network = bitcoin.networks.bitcoin;
        }
    }
    
    assert(_.every(primaryPublicKeys, function(primaryPublicKey) { return primaryPublicKey instanceof bitcoin.HDNode; }));

    // v1
    self.primaryMnemonic = primaryMnemonic;

    // v2 & v3
    self.encryptedPrimarySeed = encryptedPrimarySeed;
    self.encryptedSecret = encryptedSecret;

    self.primaryPrivateKey = null;
   
    self.primaryPublicKeys = primaryPublicKeys;
    self.keyIndex = keyIndex;

    self.chain = RskWallet.CHAIN_RSK_DEFAULT;
    self.changeChain = RskWallet.CHAIN_RSK_DEFAULT;

    self.checksum = checksum;
    self.upgradeToKeyIndex = upgradeToKeyIndex;

    self.secret = null;
    self.seedHex = null;
};

RskWallet.CHAIN_RSK_DEFAULT = 5;

RskWallet.PAY_PROGRESS_START = 0;
RskWallet.PAY_PROGRESS_COIN_SELECTION = 10;
RskWallet.PAY_PROGRESS_CHANGE_ADDRESS = 20;
RskWallet.PAY_PROGRESS_SIGN = 30;
RskWallet.PAY_PROGRESS_SEND = 40;
RskWallet.PAY_PROGRESS_DONE = 100;


RskWallet.prototype.unlock = function(options, cb) {
    var self = this;

    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    // avoid modifying passed options
    options = _.merge({}, options);

    q.fcall(function() {
        switch (self.walletVersion) {
            case Wallet.WALLET_VERSION_V1:
                return self.unlockV1(options);

            case Wallet.WALLET_VERSION_V2:
                return self.unlockV2(options);

            case Wallet.WALLET_VERSION_V3:
                return self.unlockV3(options);

            default:
                return q.reject(new blocktrail.WalletInitError("Invalid wallet version"));
        }
    }).then(
        function(primaryPrivateKey) {
            self.primaryPrivateKey = primaryPrivateKey;

            // create a checksum of our private key which we'll later use to verify we used the right password
            var checksum = self.primaryPrivateKey.getAddress();

            // check if we've used the right passphrase
            if (checksum !== self.checksum) {
                throw new blocktrail.WalletChecksumError("Generated checksum [" + checksum + "] does not match " +
                    "[" + self.checksum + "], most likely due to incorrect password");
            }

            self.locked = false;

            // if the response suggests we should upgrade to a different blocktrail cosigning key then we should
            if (typeof self.upgradeToKeyIndex !== "undefined" && self.upgradeToKeyIndex !== null) {
                return self.upgradeKeyIndex(self.upgradeToKeyIndex);
            }
        }
    ).then(
        function(r) {
            deferred.resolve(r);
        },
        function(e) {
            deferred.reject(e);
        }
    );

    return deferred.promise;
};

RskWallet.prototype.unlockV3 = function(options, cb) {
    var self = this;
    console.log("in unlock")

    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    deferred.resolve(q.fcall(function() {
        return q.when()
            .then(function() {
                /* jshint -W071, -W074 */
                options.encryptedPrimarySeed = typeof options.encryptedPrimarySeed !== "undefined" ? options.encryptedPrimarySeed : self.encryptedPrimarySeed;
                options.encryptedSecret = typeof options.encryptedSecret !== "undefined" ? options.encryptedSecret : self.encryptedSecret;

                if (options.secret) {
                    self.secret = options.secret;
                }

                if (options.primaryPrivateKey) {
                    throw new blocktrail.WalletInitError("specifying primaryPrivateKey has been deprecated");
                }

                if (options.primarySeed) {
                    self.primarySeed = options.primarySeed;
                } else if (options.secret) {
                    return self.sdk.promisedDecrypt(new Buffer(options.encryptedPrimarySeed, 'base64'), self.secret)
                        .then(function(primarySeed) {
                            self.primarySeed = primarySeed;
                        }, function() {
                            throw new blocktrail.WalletDecryptError("Failed to decrypt primarySeed");
                        });
                } else {
                    // avoid conflicting options
                    if (options.passphrase && options.password) {
                        throw new blocktrail.WalletCreateError("Can't specify passphrase and password");
                    }
                    // normalize passphrase/password
                    options.passphrase = options.passphrase || options.password;
                    delete options.password;

                    return self.sdk.promisedDecrypt(new Buffer(options.encryptedSecret, 'base64'), new Buffer(options.passphrase))
                        .then(function(secret) {
                            self.secret = secret;
                        }, function() {
                            throw new blocktrail.WalletDecryptError("Failed to decrypt secret");
                        })
                        .then(function() {
                            return self.sdk.promisedDecrypt(new Buffer(options.encryptedPrimarySeed, 'base64'), self.secret)
                                .then(function(primarySeed) {
                                    self.primarySeed = primarySeed;
                                }, function() {
                                    throw new blocktrail.WalletDecryptError("Failed to decrypt primarySeed");
                                });
                        });
                }
            })
            .then(function() {
                return bitcoin.HDNode.fromSeedBuffer(self.primarySeed, self.network);
            })
        ;
    }));

    return deferred.promise;
};

/**
 * generate a new derived private key and return the new address for it
 *
 * @param [chainIdx] int
 * @param [cb]  function        callback(err, address)
 * @returns {q.Promise}
 */
RskWallet.prototype.getNewAddress = function(chainIdx, cb) {
    var self = this;

    // chainIdx is optional
    if (typeof chainIdx === "function") {
        cb = chainIdx;
        chainIdx = null;
    }

    var deferred = q.defer();
    deferred.promise.spreadNodeify(cb);

    // Only enter if it's not an integer
    if (chainIdx !== parseInt(chainIdx, 10)) {
        // deal with undefined or null, assume defaults
        if (typeof chainIdx === "undefined" || chainIdx === null) {
            chainIdx = self.chain;
        } else {
            // was a variable but not integer
            deferred.reject(new Error("Invalid chain index"));
            return deferred.promise;
        }
    }
    
    deferred.resolve(self.sdk.getRskNewDerivation(self.identifier, "M/" + self.keyIndex + "'/" + chainIdx)
        .then(function(newDerivation) {
            var path = newDerivation.path.replace("\'","").replace('9999',"9999'");
            console.log(path)
            var addressFromServer = newDerivation.address;

            var verifyAddress = self.getAddressByPath(path);
            
            console.log("Server addy:",addressFromServer)
            console.log("Client addy:", verifyAddress)

            if (verifyAddress !== addressFromServer) {
                throw new blocktrail.WalletAddressError("Failed to verify address [" + naddressFromServer + "] !== [" + verifyAddress + "]");
            }

            return [verifyAddress, path];
        })
    );
    return deferred.promise;
};

/**
 * get address for specified path
 *
 * @param path
 * @returns string
 */
RskWallet.prototype.getAddressByPath = function(path) {
    var self = this;
    // console.log("checking this path: ", path);
    // console.log("primary priv key:",self.primaryPrivateKey);
    //bitcoin
    var derivedPrimaryPublicKey = self.getPrimaryPublicKey(path);
    console.log("btc derived key:",derivedPrimaryPublicKey);
    // var addy = derivedPrimaryPublicKey.keyPair.getAddress();
    // console.log("Bitcoin Address: ",addy);

    //rsk
    // derivedPrimaryPublicKey = self.getPrimaryPublicKeyRsk(path);
    // console.log("eth derived key: ",derivedPrimaryPublicKey)
    var derivedEthAddy = ethhdkey.fromExtendedKey(derivedPrimaryPublicKey.toBase58())
    var address = derivedEthAddy.getWallet().getAddressString()
    console.log("rsk addy: ",address)
    return address
};

// RskWallet.prototype.getPrimaryPublicKeyRsk = function(path) {
//     var self = this;
//     console.log("getprimarypublickey")
//     path = path.replace("m", "M");

//     var keyIndex = path.split("/")[1].replace("'", "");

//     if (!self.primaryPublicKeys[keyIndex]) {
//         if (self.primaryPrivateKey) {
//             self.primaryPublicKeys[keyIndex] = self.deriveByPathRsk(self.primaryPrivateKey, "M/" + keyIndex + "'", "m");
//         } else {
//             throw new blocktrail.KeyPathError("Wallet.getPrimaryPublicKey keyIndex (" + keyIndex + ") is unknown to us");
//         }
//     }
//     var primaryPublicKey = self.primaryPublicKeys[keyIndex];
//     return self.deriveByPathRsk(self.primaryPrivateKey, path, "M/" + keyIndex + "'");
// };

/**
 * get primary public key by path
 *  first level of the path is used as keyIndex to find the correct key in the dict
 *
 * @param path  string
 * @returns {bitcoin.HDNode}
 */
RskWallet.prototype.getPrimaryPublicKey = function(path) {
    var self = this;

    path = path.replace("m", "M");

    var keyIndex = path.split("/")[1].replace("'", "");

    if (!self.primaryPublicKeys[keyIndex]) {
        if (self.primaryPrivateKey) {
            self.primaryPublicKeys[keyIndex] = self.deriveByPath(self.primaryPrivateKey, "M/" + keyIndex + "'", "m");
        } else {
            throw new blocktrail.KeyPathError("Wallet.getPrimaryPublicKey keyIndex (" + keyIndex + ") is unknown to us");
        }
    }

    var primaryPublicKey = self.primaryPublicKeys[keyIndex];
    return self.deriveByPath(primaryPublicKey, path, "M/" + keyIndex + "'");
};

/**
 * create derived key from parent key by path
 *
 * @param hdKey     {bitcoin.HDNode}
 * @param path      string
 * @param keyPath   string
 * @returns {bitcoin.HDNode}
 */
RskWallet.prototype.deriveByPath = function(hdKey, path, keyPath) {
    console.log("derive by path")
    keyPath = keyPath || (!!hdKey.keyPair.d ? "m" : "M");

    if (path[0].toLowerCase() !== "m" || keyPath[0].toLowerCase() !== "m") {
        throw new blocktrail.KeyPathError("Wallet.deriveByPath only works with absolute paths. (" + path + ", " + keyPath + ")");
    }

    if (path[0] === "m" && keyPath[0] === "M") {
        throw new blocktrail.KeyPathError("Wallet.deriveByPath can't derive private path from public parent. (" + path + ", " + keyPath + ")");
    }

    // if the desired path is public while the input is private
    var toPublic = path[0] === "M" && keyPath[0] === "m";
    if (toPublic) {
        // derive the private path, convert to public when returning
        path[0] = "m";
    }

    // keyPath should be the parent parent of path
    if (path.toLowerCase().indexOf(keyPath.toLowerCase()) !== 0) {
        throw new blocktrail.KeyPathError("Wallet.derivePath requires path (" + path + ") to be a child of keyPath (" + keyPath + ")");
    }

    // remove the part of the path we already have
    path = path.substr(keyPath.length);

    // iterate over the chunks and derive
    var newKey = hdKey;
    path.replace(/^\//, "").split("/").forEach(function(chunk) {
        if (!chunk) {
            return;
        }

        if (chunk.indexOf("'") !== -1) {
            chunk = parseInt(chunk.replace("'", ""), 10) + bitcoin.HDNode.HIGHEST_BIT;
        }

        newKey = newKey.derive(parseInt(chunk, 10));
    });

    if (toPublic) {
        return newKey.neutered();
    } else {
        return newKey;
    }
};

RskWallet.prototype.decodeAddress = function(address) {
    return (ethutil.isValidAddress(address) ? {address: address, decoded: address, type: "rsk"} : new blocktrail.InvalidAddressError(err.message) );
};

RskWallet.prototype.pay = function(pay, changeAddress, allowZeroConf, randomizeChangeIdx, feeStrategy, twoFactorToken, options, cb) {

    /* jshint -W071 */
    var self = this;

    if (typeof changeAddress === "function") {
        cb = changeAddress;
        changeAddress = null;
    } else if (typeof allowZeroConf === "function") {
        cb = allowZeroConf;
        allowZeroConf = false;
    } else if (typeof randomizeChangeIdx === "function") {
        cb = randomizeChangeIdx;
        randomizeChangeIdx = true;
    } else if (typeof feeStrategy === "function") {
        cb = feeStrategy;
        feeStrategy = null;
    } else if (typeof twoFactorToken === "function") {
        cb = twoFactorToken;
        twoFactorToken = null;
    } else if (typeof options === "function") {
        cb = options;
        options = {};
    }

    randomizeChangeIdx = typeof randomizeChangeIdx !== "undefined" ? randomizeChangeIdx : true;
    feeStrategy = feeStrategy || Wallet.FEE_STRATEGY_OPTIMAL;
    options = options || {};
    var checkFee = typeof options.checkFee !== "undefined" ? options.checkFee : true;

    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    if (self.locked) {
        deferred.reject(new blocktrail.WalletLockedError("Wallet needs to be unlocked to send coins"));
        return deferred.promise;
    }

    q.nextTick(function() {
        deferred.notify(RskWallet.PAY_PROGRESS_START);
        self.buildTransaction(pay, changeAddress, allowZeroConf, randomizeChangeIdx, feeStrategy, options)
            .then(
            function(r) { return r; },
            function(e) { deferred.reject(e); },
            function(progress) {
                deferred.notify(progress);
            }
        )
            .spread(
            function(tx, utxos) {

                deferred.notify(RskWallet.PAY_PROGRESS_SEND);

                var data = {
                    signed_transaction: tx.toHex(),
                    base_transaction: tx.__toBuffer(null, null, false).toString('hex')
                };

                console.log(tx)
                console.log(data)

                return self.sendTransaction(data, utxos.map(function(utxo) { return utxo['path']; }), checkFee, twoFactorToken, options.prioboost, options)
                    .then(function(result) {
                        deferred.notify(RskWallet.PAY_PROGRESS_DONE);

                        if (!result || !result['complete'] || result['complete'] === 'false') {
                            deferred.reject(new blocktrail.TransactionSignError("Failed to completely sign transaction"));
                        } else {
                            return result['txid'];
                        }
                    });
            },
            function(e) {
                throw e;
            }
        )
            .then(
            function(r) { deferred.resolve(r); },
            function(e) { deferred.reject(e); }
        )
        ;
    });

    return deferred.promise;
};

RskWallet.prototype.buildTransaction = function(pay, changeAddress, allowZeroConf, randomizeChangeIdx, feeStrategy, options, cb) {
    /* jshint -W071 */
    var self = this;

    if (typeof changeAddress === "function") {
        cb = changeAddress;
        changeAddress = null;
    } else if (typeof allowZeroConf === "function") {
        cb = allowZeroConf;
        allowZeroConf = false;
    } else if (typeof randomizeChangeIdx === "function") {
        cb = randomizeChangeIdx;
        randomizeChangeIdx = true;
    } else if (typeof feeStrategy === "function") {
        cb = feeStrategy;
        feeStrategy = null;
    } else if (typeof options === "function") {
        cb = options;
        options = {};
    }

    randomizeChangeIdx = typeof randomizeChangeIdx !== "undefined" ? randomizeChangeIdx : true;
    feeStrategy = feeStrategy || Wallet.FEE_STRATEGY_OPTIMAL;
    options = options || {};

    
    var txb;
    var deferred = q.defer();

    async.waterfall([
        /**
         * init transaction builder
         *
         * @param cb
         */
        function(cb) {
            // blank ethereum transaction
            // @TODO - other chain ids - testnet,regtest for rsk?
            // chainId 31 is for mainnet rsk
            txb = new ethtx(null,31);

            cb();
        },
        /**
         * add transaction params
         *
         * @param cb
         */
        function(cb) {
            txb.nonce = 0;
            txb.gasPrice = 10;
            txb.gasLimit = 100;
            txb.value = 0;
            txb.data = 0;
            txb.to = "0x0000000000000000000000000000000000000000"

            cb();
        },
        /**
         * estimate fee to verify that the API is not providing us wrong data
         *
         * @param cb
         */
        function(cb) {
            // use web3.eth.gasPrice to get gas price for given network
            cb();
        },
        /**
         * sign transaction
         *
         * @param cb
         */
        function(cb) {
            var i, privKey, path

            deferred.notify(RskWallet.PAY_PROGRESS_SIGN);

            path = utxos[i]['path'].replace("M", "m");

            // todo: regenerate scripts for path and compare for utxo (paranoid mode)
            if (self.primaryPrivateKey) {
                privKey = self.deriveByPath(self.primaryPrivateKey, path, "m").keyPair.toWIF();
            }
            else {
                throw new Error("No master privateKey present");
            }
            console.log(privkey);
            txb.sign(privkey);
            serializedTx = txb.serialize();

            cb();
        },
    ], function(err) {
        if (err) {
            deferred.reject(new blocktrail.WalletSendError(err));
            return;
        }

        deferred.resolve([tx, utxos]);
    });
    
    return deferred.promise;
};

RskWallet.prototype.sendTransaction = function(txHex, paths, checkFee, twoFactorToken, prioboost, options, cb) {
    var self = this;

    if (typeof twoFactorToken === "function") {
        cb = twoFactorToken;
        twoFactorToken = null;
        prioboost = false;
    } else if (typeof prioboost === "function") {
        cb = prioboost;
        prioboost = false;
    } else if (typeof options === "function") {
        cb = options;
        options = {};
    }

    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    self.sdk.sendTransaction(self.identifier, txHex, paths, checkFee, twoFactorToken, prioboost, options)
        .then(
            function(result) {
                deferred.resolve(result);
            },
            function(e) {
                if (e.requires_2fa) {
                    deferred.reject(new blocktrail.WalletMissing2FAError());
                } else if (e.message.match(/Invalid two_factor_token/)) {
                    deferred.reject(new blocktrail.WalletInvalid2FAError());
                } else {
                    deferred.reject(e);
                }
            }
        )
    ;

    return deferred.promise;
};

RskWallet.prototype.getAccount = function(address, options, cb) {
    var self = this;

    if (typeof options === "function") {
        cb = options;
        options = {};
    }

    return self.sdk.getRskAccount(self.identifier, address, options, cb);
};

module.exports = RskWallet;