var _ = require('lodash');
var assert = require('assert');
var q = require('q');
var async = require('async');
var bitcoin = require('bitcoinjs-lib');
var blocktrail = require('./blocktrail');


/**
 *
 * @param sdk                   APIClient       SDK instance used to do requests
 * @param identifier            string          identifier of the wallet
 * @param primaryMnemonic       string          primary mnemonic
 * @param primaryPublicKeys     string          primary mnemonic
 * @param backupPublicKey       string          BIP32 master pubKey M/
 * @param blocktrailPublicKeys  array           list of blocktrail pubKeys indexed by keyIndex
 * @param keyIndex              int             key index to use
 * @param testnet               bool            testnet
 * @param checksum              string
 * @param upgradeToKeyIndex     int
 * @constructor
 * @internal
 */
var Wallet = function (
    sdk,
    identifier,
    primaryMnemonic,
    primaryPublicKeys,
    backupPublicKey,
    blocktrailPublicKeys,
    keyIndex,
    testnet,
    checksum,
    upgradeToKeyIndex
) {
    var self = this;

    self.sdk = sdk;
    self.identifier = identifier;
    self.locked = true;

    self.testnet = testnet;
    if (self.testnet) {
        self.network = bitcoin.networks.testnet;
    } else {
        self.network = bitcoin.networks.bitcoin;
    }

    assert(backupPublicKey instanceof bitcoin.HDNode);
    assert(_.all(primaryPublicKeys, function (primaryPublicKey) { return primaryPublicKey instanceof bitcoin.HDNode; }));
    assert(_.all(blocktrailPublicKeys, function (blocktrailPublicKey) { return blocktrailPublicKey instanceof bitcoin.HDNode; }));

    self.primaryMnemonic = primaryMnemonic;
    self.backupPublicKey = backupPublicKey;
    self.blocktrailPublicKeys = blocktrailPublicKeys;
    self.primaryPublicKeys = primaryPublicKeys;
    self.keyIndex = keyIndex;
    self.checksum = checksum;
    self.upgradeToKeyIndex = upgradeToKeyIndex;
};

Wallet.PAY_PROGRESS_START = 0;
Wallet.PAY_PROGRESS_COIN_SELECTION = 10;
Wallet.PAY_PROGRESS_CHANGE_ADDRESS = 20;
Wallet.PAY_PROGRESS_SIGN = 30;
Wallet.PAY_PROGRESS_SEND = 40;
Wallet.PAY_PROGRESS_DONE = 100;

Wallet.prototype.unlock = function (options, cb) {
    var self = this;

    options.primaryMnemonic = typeof options.primaryMnemonic !== "undefined" ? options.primaryMnemonic : self.primaryMnemonic;

    return self.sdk.resolvePrimaryPrivateKeyFromOptions(options).spread(
        function (primaryMnemonic, primaryPrivateKey) {
            self.primaryMnemonic = primaryMnemonic;
            self.primaryPrivateKey = primaryPrivateKey;

            // create a checksum of our private key which we'll later use to verify we used the right password
            var checksum = self.primaryPrivateKey.getAddress().toBase58Check();

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
    ).nodeify(cb);
};

Wallet.prototype.lock = function () {
    var self = this;

    self.primaryPrivateKey = "";

    self.locked = true;
};

/**
 * get address for specified path
 *
 * @param path
 * @returns string
 */
Wallet.prototype.getAddressByPath = function (path) {
    var self = this;

    var redeemScript = self.getRedeemScriptByPath(path);

    var scriptPubKey = bitcoin.scripts.scriptHashOutput(redeemScript.getHash());
    var address = bitcoin.Address.fromOutputScript(scriptPubKey, self.network);

    return address.toString();
};

/**
 * get redeemscript for specified path
 *
 * @param path
 * @returns {bitcoin.Script}
 */
Wallet.prototype.getRedeemScriptByPath = function (path) {
    var self = this;

    // get derived primary key
    var derivedPrimaryPublicKey = self.getPrimaryPublicKey(path);
    // get derived blocktrail key
    var derivedBlocktrailPublicKey = self.getBlocktrailPublicKey(path);
    // derive the backup key
    var derivedBackupPublicKey = Wallet.deriveByPath(self.backupPublicKey, path.replace("'", ""), "M");

    // sort the pubkeys
    var pubKeys = Wallet.sortMultiSigKeys([
        derivedPrimaryPublicKey.pubKey,
        derivedBackupPublicKey.pubKey,
        derivedBlocktrailPublicKey.pubKey
    ]);

    // create multisig
    return bitcoin.scripts.multisigOutput(2, pubKeys);
};

/**
 * get primary public key by path
 *  first level of the path is used as keyIndex to find the correct key in the dict
 *
 * @param path  string
 * @returns {bitcoin.HDNode}
 */
Wallet.prototype.getPrimaryPublicKey = function (path) {
    var self = this;

    path = path.replace("m", "M");

    var keyIndex = path.split("/")[1].replace("'", "");

    if (!self.primaryPublicKeys[keyIndex]) {
        if (self.primaryPrivateKey) {
            self.primaryPublicKeys[keyIndex] = Wallet.deriveByPath(self.primaryPrivateKey, "M/" + keyIndex + "'", "m");
        } else {
            throw new blocktrail.KeyPathError("Wallet.getPrimaryPublicKey keyIndex (" + keyIndex + ") is unknown to us");
        }
    }

    var primaryPublicKey = self.primaryPublicKeys[keyIndex];

    return Wallet.deriveByPath(primaryPublicKey, path, "M/" + keyIndex + "'");
};

/**
 * get blocktrail public key by path
 *  first level of the path is used as keyIndex to find the correct key in the dict
 *
 * @param path  string
 * @returns {bitcoin.HDNode}
 */
Wallet.prototype.getBlocktrailPublicKey = function (path) {
    var self = this;

    path = path.replace("m", "M");

    var keyIndex = path.split("/")[1].replace("'", "");

    if (!self.blocktrailPublicKeys[keyIndex]) {
        throw new blocktrail.KeyPathError("Wallet.getBlocktrailPublicKey keyIndex (" + keyIndex + ") is unknown to us");
    }

    var blocktrailPublicKey = self.blocktrailPublicKeys[keyIndex];

    return Wallet.deriveByPath(blocktrailPublicKey, path, "M/" + keyIndex + "'");
};

/**
 * upgrade wallet to different blocktrail cosign key
 *
 * @param keyIndex  int
 * @param [cb]      function
 * @returns {q.Promise}
 */
Wallet.prototype.upgradeKeyIndex = function (keyIndex, cb) {
    var self = this;

    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    if (self.locked) {
        deferred.reject(new blocktrail.WalletLockedError("Wallet needs to be unlocked to upgrade key index"));
        return deferred.promise;
    }

    var primaryPublicKey = self.primaryPrivateKey.deriveHardened(keyIndex).neutered();

    deferred.resolve(
        self.sdk.upgradeKeyIndex(self.identifier, keyIndex, [primaryPublicKey.toBase58(), "M/" + keyIndex + "'"])
            .then(function (result) {
                self.keyIndex = keyIndex;
                _.forEach(result.blocktrail_public_keys, function (publicKey, keyIndex) {
                    self.blocktrailPublicKeys[keyIndex] = bitcoin.HDNode.fromBase58(publicKey[0], self.network);
                });

                self.primaryPublicKeys[keyIndex] = primaryPublicKey;

                return true;
            })
    );

    return deferred.promise;
};

/**
 * generate a new derived private key and return the new address for it
 *
 * @param [cb]  function        callback(err, address)
 * @returns {q.Promise}
 */
Wallet.prototype.getNewAddress = function (cb) {
    var self = this;

    var deferred = q.defer();
    deferred.promise.spreadNodeify(cb);

    deferred.resolve(
        self.sdk.getNewDerivation(self.identifier, "M/" + self.keyIndex + "'/0")
            .then(function (newDerivation) {
                var path = newDerivation.path;
                var address = self.getAddressByPath(newDerivation.path);

                // debug check
                if (address !== newDerivation.address) {
                    throw new blocktrail.WalletAddressError("Failed to verify address [" + newDerivation.address + "] !== [" + address + "]");
                }

                return [address, path];
            })
    );

    return deferred.promise;
};

/**
 * get the balance for the wallet
 *
 * @param [cb]  function        callback(err, confirmed, unconfirmed)
 * @returns {q.Promise}
 */
Wallet.prototype.getBalance = function (cb) {
    var self = this;

    var deferred = q.defer();
    deferred.promise.spreadNodeify(cb);

    deferred.resolve(
        self.sdk.getWalletBalance(self.identifier)
            .then(function (result) {
                return [result.confirmed, result.unconfirmed];
            })
    );

    return deferred.promise;
};

/**
 * do wallet discovery (slow)
 *
 * @param [gap] int             gap limit
 * @param [cb]  function        callback(err, confirmed, unconfirmed)
 * @returns {q.Promise}
 */
Wallet.prototype.doDiscovery = function (gap, cb) {
    var self = this;

    if (typeof gap === "function") {
        cb = gap;
        gap = null;
    }

    var deferred = q.defer();
    deferred.promise.spreadNodeify(cb);

    deferred.resolve(
        self.sdk.doWalletDiscovery(self.identifier, gap)
            .then(function (result) {
                return [result.confirmed, result.unconfirmed];
            })
    );

    return deferred.promise;
};

/**
 *
 * @param [force]   bool            ignore warnings (such as non-zero balance)
 * @param [cb]      function        callback(err, success)
 * @returns {q.Promise}
 */
Wallet.prototype.deleteWallet = function (force, cb) {
    var self = this;

    if (typeof force === "function") {
        cb = force;
        force = false;
    }

    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    if (self.locked) {
        deferred.reject(new blocktrail.WalletDeleteError("Wallet needs to be unlocked to delete wallet"));
        return deferred.promise;
    }

    var checksum = self.primaryPrivateKey.getAddress().toBase58Check();
    var signature = bitcoin.Message.sign(self.primaryPrivateKey.privKey, checksum, self.network).toString('base64');

    deferred.resolve(
        self.sdk.deleteWallet(self.identifier, checksum, signature, force)
            .then(function (result) {
                return result.deleted;
            })
    );

    return deferred.promise;
};

/**
 * create, sign and send a transaction
 *
 * @param pay                   array       {'address': (int)value}     coins to send
 * @param [changeAddress]       bool        change address to use (auto generated if NULL)
 * @param [allowZeroConf]       bool        allow zero confirmation unspent outputs to be used in coin selection
 * @param [randomizeChangeIdx]  bool        randomize the index of the change output (default TRUE, only disable if you have a good reason to)
 * @param [cb]                  function    callback(err, txHash)
 * @returns {q.Promise}
 */
Wallet.prototype.pay = function (pay, changeAddress, allowZeroConf, randomizeChangeIdx, cb) {
    /* jshint -W071 */
    var self = this;

    if (typeof changeAddress === "function") {
        cb = changeAddress;
        changeAddress = null;
        allowZeroConf = false;
        randomizeChangeIdx = true;
    } else if (typeof allowZeroConf === "function") {
        cb = allowZeroConf;
        allowZeroConf = false;
        randomizeChangeIdx = true;
    } else if (typeof randomizeChangeIdx === "function") {
        cb = randomizeChangeIdx;
        randomizeChangeIdx = true;
    }

    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    if (self.locked) {
        deferred.reject(new blocktrail.WalletLockedError("Wallet needs to be unlocked to send coins"));
        return deferred.promise;
    }

    q.nextTick(function () {
        deferred.notify(Wallet.PAY_PROGRESS_START);

        self.buildTransaction(pay, changeAddress, allowZeroConf, randomizeChangeIdx)
            .then(
                function (r) { return r; },
                function (e) { deferred.reject(e); },
                function (progress) {
                    deferred.notify(progress);
                }
            )
            .spread(
                function (tx, utxos) {
                    deferred.notify(Wallet.PAY_PROGRESS_SEND);

                    return self.sendTransaction(tx.toHex(), utxos.map(function (utxo) { return utxo['path']; }), true)
                        .then(function (result) {
                            deferred.notify(Wallet.PAY_PROGRESS_DONE);

                            if (!result || !result['complete'] || result['complete'] === 'false') {
                                return deferred.reject(new blocktrail.TransactionSignError("Failed to completely sign transaction"));
                            } else {
                                return result['txid'];
                            }
                        });
                },
                function (e) {
                    throw e;
                }
            )
            .then(
                function (r) { deferred.resolve(r); },
                function (e) { deferred.reject(e); }
            )
        ;
    });

    return deferred.promise;
};

Wallet.prototype.buildTransaction = function (pay, changeAddress, allowZeroConf, randomizeChangeIdx, cb) {
    /* jshint -W071 */
    var self = this;

    if (typeof changeAddress === "function") {
        cb = changeAddress;
        changeAddress = null;
        allowZeroConf = false;
        randomizeChangeIdx = true;
    } else if (typeof allowZeroConf === "function") {
        cb = allowZeroConf;
        allowZeroConf = false;
        randomizeChangeIdx = true;
    } else if (typeof randomizeChangeIdx === "function") {
        cb = randomizeChangeIdx;
        randomizeChangeIdx = true;
    }

    var deferred = q.defer();
    deferred.promise.spreadNodeify(cb);

    q.nextTick(function () {
        var send = {};

        Object.keys(pay).forEach(function (address) {
            address = address.trim();
            var value = pay[address];
            var err = null;

            var addr;
            try {
                addr = bitcoin.Address.fromBase58Check(address);
            } catch (_err) {
                err = _err;
            }

            if (!addr || err) {
                err = new blocktrail.InvalidAddressError("Invalid address [" + address + "]" + (err ? " (" + err.message + ")" : ""));
            } else if (parseInt(value, 10).toString() !== value.toString()) {
                err = new blocktrail.WalletSendError("Values should be in Satoshis");
            } else if (!(value = parseInt(value, 10))) {
                err = new blocktrail.WalletSendError("Values should be non zero");
            } else if (value <= blocktrail.DUST) {
                err = new blocktrail.WalletSendError("Values should be more than dust (" + blocktrail.DUST + ")");
            }

            if (err) {
                deferred.reject(err);
                return deferred.promise;
            }

            send[address] = value;
        });

        deferred.notify(Wallet.PAY_PROGRESS_COIN_SELECTION);

        deferred.resolve(
            self.coinSelection(pay, true, allowZeroConf)
            /**
             *
             * @param {Object[]} utxos
             * @param fee
             * @param change
             * @param randomizeChangeIdx
             * @returns {*}
             */
                .spread(function (utxos, fee, change) {
                    var tx, txb, outputs = [];

                    var deferred = q.defer();

                    async.waterfall([
                        /**
                         * prepare
                         *
                         * @param cb
                         */
                            function (cb) {
                            var inputsTotal = utxos.map(function (utxo) {
                                    return utxo['value'];
                                }).reduce(function (a, b) {
                                    return a + b;
                                }),
                                outputsTotal = Object.keys(send).map(function (address) {
                                    return send[address];
                                }).reduce(function (a, b) {
                                    return a + b;
                                }),
                                estimatedChange = inputsTotal - outputsTotal - fee;

                            if (inputsTotal - outputsTotal - fee !== change) {
                                return cb(new blocktrail.WalletFeeError("the amount of change (" + change + ") " +
                                "suggested by the coin selection seems incorrect (" + estimatedChange + ")"));
                            }

                            cb();
                        },
                        /**
                         * init transaction builder
                         *
                         * @param cb
                         */
                        function (cb) {
                            txb = new bitcoin.TransactionBuilder();

                            cb();
                        },
                        /**
                         * add UTXOs as inputs
                         *
                         * @param cb
                         */
                        function (cb) {
                            var i;

                            for (i = 0; i < utxos.length; i++) {
                                txb.addInput(utxos[i]['hash'], utxos[i]['idx']);
                            }

                            cb();

                        },
                        /**
                         * build desired outputs
                         *
                         * @param cb
                         */
                        function (cb) {
                            Object.keys(send).forEach(function (address) {
                                outputs.push({address: address, value: parseInt(send[address], 10)});
                            });

                            cb();
                        },
                        /**
                         * get change address if required
                         *
                         * @param cb
                         */
                        function (cb) {
                            if (change > 0 && !changeAddress) {
                                deferred.notify(Wallet.PAY_PROGRESS_CHANGE_ADDRESS);

                                self.getNewAddress(function (err, address) {
                                    if (err) {
                                        return cb(err);
                                    }

                                    changeAddress = address;
                                    cb();
                                });
                            } else {
                                cb();
                            }
                        },
                        /**
                         * add change to outputs
                         *
                         * @param cb
                         */
                        function (cb) {
                            if (change > 0) {
                                if (randomizeChangeIdx) {
                                    outputs.splice(_.random(0, outputs.length), 0, {
                                        address: changeAddress,
                                        value: change
                                    });
                                } else {
                                    outputs.push({address: changeAddress, value: change});
                                }
                            }

                            cb();
                        },
                        /**
                         * add outputs to txb
                         *
                         * @param cb
                         */
                        function (cb) {
                            outputs.forEach(function (outputInfo) {
                                txb.addOutput(outputInfo.address, outputInfo.value);
                            });

                            cb();
                        },
                        /**
                         * sign
                         *
                         * @param cb
                         */
                        function (cb) {
                            var i;

                            deferred.notify(Wallet.PAY_PROGRESS_SIGN);

                            for (i = 0; i < utxos.length; i++) {
                                var privKey = Wallet.deriveByPath(self.primaryPrivateKey, utxos[i]['path'].replace("M", "m"), "m").privKey;
                                var redeemScript = bitcoin.Script.fromHex(utxos[i]['redeem_script']);

                                txb.sign(i, privKey, redeemScript);
                            }

                            tx = txb.buildIncomplete();

                            cb();
                        },
                        /**
                         * estimate fee
                         *
                         * @param cb
                         */
                        function (cb) {
                            var estimatedFee = Wallet.estimateIncompleteTxFee(tx);
                            if (estimatedFee !== fee) {
                                return cb(new blocktrail.WalletFeeError("the fee suggested by the coin selection (" + fee + ") " +
                                                                        "seems incorrect (" + estimatedFee + ")"));
                            }

                            cb();
                        }
                    ], function (err) {
                        if (err) {
                            return deferred.reject(new blocktrail.WalletSendError(err));
                        }

                        return deferred.resolve([tx, utxos]);
                    });

                    return deferred.promise;
                }
            )
        );
    });

    return deferred.promise;
};

/**
 * use the API to get the best inputs to use based on the outputs
 *
 * @param pay               array       {'address': (int)value}     coins to send
 * @param lockUTXO          bool        lock UTXOs for a few seconds to allow for transaction to be created
 * @param allowZeroConf     bool        allow zero confirmation unspent outputs to be used in coin selection
 * @param [cb]              function    callback(err, utxos, fee, change)
 * @returns {q.Promise}
 */
Wallet.prototype.coinSelection = function (pay, lockUTXO, allowZeroConf, cb) {
    var self = this;

    return self.sdk.coinSelection(self.identifier, pay, lockUTXO, allowZeroConf, cb);
};

/**
 * send the transaction using the API
 *
 * @param txHex     string      partially signed transaction as hex string
 * @param paths     array       list of paths used in inputs which should be cosigned by the API
 * @param checkFee  bool        when TRUE the API will verify if the fee is 100% correct and otherwise throw an exception
 * @param [cb]      function    callback(err, txHash)
 * @returns {q.Promise}
 */
Wallet.prototype.sendTransaction = function (txHex, paths, checkFee, cb) {
    var self = this;

    return self.sdk.sendTransaction(self.identifier, txHex, paths, checkFee, cb);
};

/**
 * setup a webhook for this wallet
 *
 * @param url           string      URL to receive webhook events
 * @param [identifier]  string      identifier for the webhook, defaults to WALLET- + wallet.identifier
 * @param [cb]          function    callback(err, webhook)
 * @returns {q.Promise}
 */
Wallet.prototype.setupWebhook = function (url, identifier, cb) {
    var self = this;

    if (typeof identifier === "function") {
        cb = identifier;
        identifier = null;
    }

    if (!identifier) {
        identifier = 'WALLET-' + self.identifier;
    }

    return self.sdk.setupWalletWebhook(self.identifier, identifier, url, cb);
};

/**
 * delete a webhook that was created for this wallet
 *
 * @param [identifier]  string      identifier for the webhook, defaults to WALLET- + wallet.identifier
 * @param [cb]          function    callback(err, success)
 * @returns {q.Promise}
 */
Wallet.prototype.deleteWebhook = function (identifier, cb) {
    var self = this;

    if (typeof identifier === "function") {
        cb = identifier;
        identifier = null;
    }

    if (!identifier) {
        identifier = 'WALLET-' + self.identifier;
    }

    return self.sdk.deleteWalletWebhook(self.identifier, identifier, cb);
};

/**
 * get all transactions for the wallet (paginated)
 *
 * @param [params]  array       pagination: {page: 1, limit: 20, sort_dir: 'asc'}
 * @param [cb]      function    callback(err, transactions)
 * @returns {q.Promise}
 */
Wallet.prototype.transactions = function (params, cb) {
    var self = this;

    return self.sdk.walletTransactions(self.identifier, params, cb);
};

/**
 * get all addresses for the wallet (paginated)
 *
 * @param [params]  array       pagination: {page: 1, limit: 20, sort_dir: 'asc'}
 * @param [cb]      function    callback(err, addresses)
 * @returns {q.Promise}
 */
Wallet.prototype.addresses = function (params, cb) {
    var self = this;

    return self.sdk.walletAddresses(self.identifier, params, cb);
};

/**
 * get all UTXOs for the wallet (paginated)
 *
 * @param [params]  array       pagination: {page: 1, limit: 20, sort_dir: 'asc'}
 * @param [cb]      function    callback(err, addresses)
 * @returns {q.Promise}
 */
Wallet.prototype.utxos = function (params, cb) {
    var self = this;

    return self.sdk.walletUTXOs(self.identifier, params, cb);
};

Wallet.prototype.unspentOutputs = Wallet.prototype.utxos;

/**
 * sort list of pubkeys to be used in a multisig redeemscript
 *  sorted in lexicographical order on the hex of the pubkey
 *
 * @param pubKeys   {bitcoin.HDNode[]}
 * @returns string[]
 */
Wallet.sortMultiSigKeys = function (pubKeys) {
    pubKeys.sort(function (key1, key2) {
        return key1.toHex().localeCompare(key2.toHex());
    });

    return pubKeys;
};

/**
 * determine how much fee is required based on the inputs and outputs
 *  this is an estimation, not a proper 100% correct calculation
 *
 * @param {bitcoin.Transaction} tx
 * @returns {number}
 */
Wallet.estimateIncompleteTxFee = function (tx) {
    var size = 4 + 4;

    size += tx.outs.length * 34;

    tx.ins.forEach(function (txin) {
        var scriptSig = bitcoin.Script.fromBuffer(txin.script.buffer),
            scriptType = bitcoin.scripts.classifyInput(scriptSig);

        var multiSig = false;

        // Re-classify if P2SH
        if (scriptType === 'scripthash') {
            var redeemScript = bitcoin.Script.fromBuffer(scriptSig.chunks.slice(-1)[0]);
            scriptSig = bitcoin.Script.fromChunks(scriptSig.chunks.slice(0, -1));
            scriptType = bitcoin.scripts.classifyInput(scriptSig);

            if (bitcoin.scripts.classifyOutput(redeemScript) !== scriptType) {
                throw new blocktrail.TransactionInputError('Non-matching scriptSig and scriptPubKey in input');
            }

            // figure out M of N for multisig (code from internal usage of bitcoinjs)
            if (scriptType === 'multisig') {
                var mOp = redeemScript.chunks[0];
                if (mOp === bitcoin.opcodes.OP_0 || mOp < bitcoin.opcodes.OP_1 || mOp > bitcoin.opcodes.OP_16) {
                    throw new blocktrail.TransactionInputError("Invalid multisig redeemScript");
                }

                var nOp = redeemScript.chunks[redeemScript.chunks.length - 2];
                if (mOp === bitcoin.opcodes.OP_0 || mOp < bitcoin.opcodes.OP_1 || mOp > bitcoin.opcodes.OP_16) {
                    throw new blocktrail.TransactionInputError("Invalid multisig redeemScript");
                }

                var m = mOp - (bitcoin.opcodes.OP_1 - 1);
                var n = nOp - (bitcoin.opcodes.OP_1 - 1);
                if (n < m) {
                    throw new blocktrail.TransactionInputError("Invalid multisig redeemScript");
                }

                multiSig = [m, n];
            }
        }

        if (multiSig) {
            size += 32 + // txhash
            4 + // idx
            (72 * multiSig[0]) + // sig
            106 + // script
            4 + // ?
            4; // sequence

        } else {
            size += 32 + // txhash
            4 + // idx
            72 + // sig
            32 + // script
            4 + // ?
            4; // sequence
        }
    });

    var sizeKB = Math.ceil(size / 1000);

    return sizeKB * blocktrail.BASE_FEE;
};

/**
 * create derived key from parent key by path
 *
 * @param hdKey     {bitcoin.HDNode}
 * @param path      string
 * @param keyPath   string
 * @returns {bitcoin.HDNode}
 */
Wallet.deriveByPath = function (hdKey, path, keyPath) {
    keyPath = keyPath || (!!hdKey.privKey ? "m" : "M");

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
    path.replace(/^\//, "").split("/").forEach(function (chunk) {
        if (!chunk) {
            return;
        }

        if (chunk.indexOf("'") !== -1) {
            chunk = parseInt(chunk.replace("'", ""), 10) + bitcoin.HDNode.HIGHEST_BIT;
        }

        newKey = newKey.derive(chunk);
    });

    if (toPublic) {
        return newKey.neutered();
    } else {
        return newKey;
    }
};

module.exports = Wallet;
