var q = require('q');
var async = require('async');
var bitcoin = require('bitcoinjs-lib');
var blocktrail = require('./blocktrail');

// apply patch to Q to add spreadNodeify
blocktrail.patchQ(q);

var Wallet = function (sdk, identifier, primaryMnemonic, primaryPrivateKey, backupPublicKey, blocktrailPublicKeys, keyIndex, testnet) {
    var self = this;

    self.sdk = sdk;
    self.identifier = identifier;

    self.testnet = testnet;
    if(self.testnet) {
        self.network = bitcoin.networks.testnet;
    } else {
        self.network = bitcoin.networks.bitcoin;
    }

    self.primaryMnemonic = primaryMnemonic;
    self.primaryPrivateKey = primaryPrivateKey;
    self.backupPublicKey = new bitcoin.HDNode.fromBase58(backupPublicKey[0], self.network);
    self.blocktrailPublicKeys = blocktrailPublicKeys;
    self.keyIndex = keyIndex;
};

/**
 * sort list of pubkeys to be used in a multisig redeemscript
 *  sorted in lexicographical order on the hex of the pubkey
 *
 * @param pubKeys
 * @returns string[]
 */
Wallet.sortMultiSigKeys = function(pubKeys) {
    pubKeys.sort(function(key1, key2) {
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
Wallet.estimateIncompleteTxFee = function(tx) {
    var size = 4 + 4;

    size += tx.outs.length * 34;

    tx.ins.forEach(function(txin) {
        var scriptSig = bitcoin.Script.fromBuffer(txin.script.buffer),
            scriptType = bitcoin.scripts.classifyInput(scriptSig);

        var multiSig = false;

        // Re-classify if P2SH
        if (scriptType === 'scripthash') {
            var redeemScript = bitcoin.Script.fromBuffer(scriptSig.chunks.slice(-1)[0]);
            scriptSig = bitcoin.Script.fromChunks(scriptSig.chunks.slice(0, -1));
            scriptType = bitcoin.scripts.classifyInput(scriptSig);

            if (bitcoin.scripts.classifyOutput(redeemScript) != scriptType) {
                throw new Error('Non-matching scriptSig and scriptPubKey in input');
            }

            // figure out M of N for multisig (code from internal usage of bitcoinjs)
            if (scriptType == 'multisig') {
                var mOp = redeemScript.chunks[0];
                if (mOp === bitcoin.opcodes.OP_0 || mOp < bitcoin.opcodes.OP_1 || mOp > bitcoin.opcodes.OP_16) {
                    throw new Error("Invalid multisig redeemScript");
                }

                var nOp = redeemScript.chunks[redeemScript.chunks.length - 2];
                if (mOp === bitcoin.opcodes.OP_0 || mOp < bitcoin.opcodes.OP_1 || mOp > bitcoin.opcodes.OP_16) {
                    throw new Error("Invalid multisig redeemScript");
                }

                var m = mOp - (bitcoin.opcodes.OP_1 - 1);
                var n = nOp - (bitcoin.opcodes.OP_1 - 1);
                if (n < m) {
                    throw new Error("Invalid multisig redeemScript");
                }

                multiSig = [m, n];
            }
        }

        if (multiSig) {
            size += 32 // txhash
                 + 4 // idx
                 + (72 * multiSig[0]) // sig
                 + 106 // script
                 + 4 // ?
                 + 4; // sequence

        } else {
            size += 32 // txhash
                + 4 // idx
                + 72 // sig
                + 32 // script
                + 4 // ?
                + 4; // sequence
        }
    });

    var sizeKB = Math.ceil(size / 1000);

    return sizeKB * blocktrail.BASE_FEE;
};

/**
 * create derived key from parent key by path
 *
 * @param hdKey
 * @param path
 * @param keyPath
 * @returns {bitcoin.HDNode}
 */
Wallet.deriveByPath = function(hdKey, path, keyPath) {
    keyPath = keyPath || (!!hdKey.privKey ? "m" : "M");

    if (path[0].toLowerCase() != "m" || keyPath[0].toLowerCase() != "m") {
        throw new Error("Wallet.deriveByPath only works with absolute paths. (" + path + ", " + keyPath + ")");
    }

    if (path[0] == "m" && keyPath[0] == "M") {
        throw new Error("Wallet.deriveByPath can't derive private path from public parent. (" + path + ", " + keyPath + ")");
    }

    // if the desired path is public while the input is private
    var toPublic = path[0] == "M" && keyPath[0] == "m";
    if (toPublic) {
        // derive the private path, convert to public when returning
        path[0] = "m";
    }

    // keyPath should be the parent parent of path
    if (path.toLowerCase().indexOf(keyPath.toLowerCase()) !== 0) {
        throw new Error("Wallet.derivePath requires path (" + path + ") to be a child of keyPath (" + keyPath + ")");
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

        newKey = newKey.derive(chunk);
    });

    if (toPublic) {
        return newKey.neutered();
    } else {
        return newKey;
    }
};

/**
 * get address for specified path
 *
 * @param path
 * @returns string
 */
Wallet.prototype.getAddressByPath = function(path) {
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
Wallet.prototype.getRedeemScriptByPath = function(path) {
    var self = this;

    // get derived primary key
    var derivedPrimaryKey = Wallet.deriveByPath(self.primaryPrivateKey, path, "m");
    // get derived blocktrail key
    var derivedBlocktrailPublicKey = self.getBlocktrailPublicKey(path);
    // derive the backup key
    var derivedBackupPublicKey = Wallet.deriveByPath(self.backupPublicKey, path.replace("'", ""), "M");

    // sort the pubkeys
    var pubKeys = Wallet.sortMultiSigKeys([
        derivedPrimaryKey.pubKey,
        derivedBackupPublicKey.pubKey,
        derivedBlocktrailPublicKey.pubKey
    ]);

    // create multisig
    return bitcoin.scripts.multisigOutput(2, pubKeys);
};

/**
 * get blocktrail public key by path
 *  first level of the path is used as keyIndex to find the correct key in the dict
 *
 * @param path
 * @returns {bitcoin.HDNode}
 */
Wallet.prototype.getBlocktrailPublicKey = function(path) {
    var self = this;

    path = path.replace("m", "M");

    var keyIndex = path.split("/")[1].replace("'", "");

    if (!self.blocktrailPublicKeys[keyIndex]) {
        throw new Error("Wallet.getBlocktrailPublicKey keyIndex (" + keyIndex + ") is unknown to us");
    }

    var blocktrailPublicKey = bitcoin.HDNode.fromBase58(self.blocktrailPublicKeys[keyIndex][0], self.network);

    return Wallet.deriveByPath(blocktrailPublicKey, path, "M/" + keyIndex + "'");
};

Wallet.prototype.upgradeKeyIndex = function(keyIndex, cb) {
    var self = this;

    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    var primaryPublicKey = self.primaryPrivateKey.deriveHardened(keyIndex).neutered();
    primaryPublicKey = [primaryPublicKey.toBase58(), "M/" + keyIndex + "'"];

    self.sdk.upgradeKeyIndex(self.identifier, keyIndex, primaryPublicKey, function(err, result) {
        self.keyIndex = keyIndex;
        for (var _keyIndex in result.blocktrail_public_keys) {
            self.blocktrailPublicKeys[_keyIndex] = result.blocktrail_public_keys[_keyIndex];
        }

        deferred.resolve();
    });

    return deferred.promise;
};

Wallet.prototype.getNewAddress = function(cb) {
    var self = this;

    var deferred = q.defer();
    deferred.promise.spreadNodeify(cb);

    self.sdk.getNewDerivation(self.identifier, "M/" + self.keyIndex + "'/0", function(err, newDerivation) {
        if (err) {
            return deferred.reject(err);
        }

        var path = newDerivation.path;
        var address = self.getAddressByPath(newDerivation.path);

        // debug check
        if (address != newDerivation.address) {
            err = new Error("Failed to verify address [" + newDerivation.address + "] != [" + address + "]");
            return deferred.reject(err);
        }

        return deferred.resolve([address, path]);
    });

    return deferred.promise;
};

Wallet.prototype.getBalance = function(cb) {
    var self = this;

    var deferred = q.defer();
    deferred.promise.spreadNodeify(cb);

    self.sdk.getWalletBalance(self.identifier, function(err, result) {
        if (err) {
            return deferred.reject(err);
        }

        return deferred.resolve([result.confirmed, result.unconfirmed]);
    });

    return deferred.promise;
};

Wallet.prototype.doDiscovery = function(cb) {
    var self = this;

    var deferred = q.defer();
    deferred.promise.spreadNodeify(cb);

    self.sdk.doWalletDiscovery(self.identifier, function(err, result) {
        if (err) {
            return deferred.reject(err);
        }

        return deferred.resolve([result.confirmed, result.unconfirmed]);
    });

    return deferred.promise;
};

Wallet.prototype.deleteWallet = function(cb) {
    var self = this;

    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    var checksum = self.primaryPrivateKey.getAddress().toBase58Check();
    var signature = bitcoin.Message.sign(self.primaryPrivateKey.privKey, checksum, self.network);

    self.sdk.deleteWallet(self.identifier, checksum, signature, function(err, result) {
        if (err) {
            return deferred.reject(err);
        }

        return deferred.resolve(result.deleted);
    });

    return deferred.promise;
};

Wallet.prototype.pay = function(pay, changeAddress, allowZeroConf, cb) {
    var self = this;

    if (typeof changeAddress == "function") {
        cb = changeAddress;
        changeAddress = null;
        allowZeroConf = false;
    } else if (typeof allowZeroConf == "function") {
        cb = allowZeroConf;
        allowZeroConf = false;
    }

    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    var send = {}, address;
    for (address in pay) {
        var value = pay[address];
        var err;

        if (!bitcoin.Address.fromBase58Check(address)) {
            err = new Error("Invalid address [" + address + "]");
        } else if (parseInt(value, 10).toString() != value.toString()) {
            err = new Error("Values should be in Satoshis");
        } else if (!(value = parseInt(value, 10))) {
            err = new Error("Values should be non zero");
        } else if (value <= blocktrail.DUST) {
            err = new Error("Values should be more than dust (" + blocktrail.DUST + ")");
        }

        if (err) {
            return deferred.reject(err);
        }

        send[address] = value;
    }

    self.coinSelection(
        pay,
        true,
        allowZeroConf,
        /**
         *
         * @param err
         * @param {Object[]} utxos
         * @param fee
         * @param change
         * @returns {*}
         */
        function(err, utxos, fee, change) {
            var tx, txb;

            if (err) {
                return deferred.reject(err);
            }

            async.waterfall([
                function(cb) {
                    var inputsTotal = utxos.map(function(utxo) { return utxo['value']; }).reduce(function(a, b) { return a + b; }),
                        outputsTotal = Object.keys(send).map(function(address) { return send[address]; }).reduce(function(a, b) { return a + b; }),
                        estimatedChange = inputsTotal - outputsTotal - fee;

                    if (inputsTotal - outputsTotal - fee != change) {
                        return cb(new Error("the amount of change (" + change + ") suggested by the coin selection seems incorrect (" + estimatedChange + ")"));
                    }

                    cb();
                },
                function(cb) {
                    if (change > 0) {
                        if (!changeAddress) {
                            return self.getNewAddress(function(err, address) {
                                changeAddress = address;
                                send[changeAddress] = change;
                                return cb();
                            });
                        }
                    }

                    cb();
                },
                function(cb) {
                    var i, address;

                    txb = new bitcoin.TransactionBuilder();

                    for (i = 0; i < utxos.length; i++) {
                        txb.addInput(utxos[i]['hash'], utxos[i]['idx']);
                    }

                    for (address in send) {
                        txb.addOutput(address, parseInt(send[address], 10));
                    }

                    for (i = 0; i < utxos.length; i++) {
                        var privKey = Wallet.deriveByPath(self.primaryPrivateKey, utxos[i]['path'].replace("M", "m"), "m").privKey;
                        var redeemScript = bitcoin.Script.fromHex(utxos[i]['redeem_script']);

                        txb.sign(i, privKey, redeemScript);
                    }

                    tx = txb.buildIncomplete();

                    cb();
                },
                function(cb) {
                    var estimatedFee = Wallet.estimateIncompleteTxFee(tx);
                    if (estimatedFee != fee) {
                        return cb(new Error("the fee suggested by the coin selection (" + fee + ") seems incorrect (" + estimatedFee + ")"));
                    }

                    cb();
                },
                function(cb) {
                    self.sendTransaction(tx.toHex(), utxos.map(function(utxo) { return utxo['path']; }), true, cb);
                }
            ], function(err, result) {
                if (err) {
                    return deferred.reject(err);
                }

                if (!result || !result['complete'] || result['complete'] === 'false') {
                    err = new Error("Failed to completely sign transaction");
                    return deferred.reject(err);
                }

                return deferred.resolve(result.txid);
            });
        }
    );

    return deferred.promise;
};

Wallet.prototype.coinSelection = function(pay, lockUTXO, allowZeroConf, cb) {
    var self = this;

    return self.sdk.coinSelection(self.identifier, pay, lockUTXO, allowZeroConf, cb);
};

Wallet.prototype.sendTransaction = function(txHex, paths, checkFee, cb) {
    var self = this;

    return self.sdk.sendTransaction(self.identifier, txHex, paths, checkFee, cb);
};

module.exports = Wallet;
