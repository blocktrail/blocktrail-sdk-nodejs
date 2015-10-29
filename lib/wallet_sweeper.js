var unspentOutputFinder = require('./unspent_output_finder');
var bitcoin = require('bitcoinjs-lib');
var bip39 = require("bip39");
var CryptoJS = require('crypto-js');
var blocktrailSDK = require('./api_client');
var blocktrail = require('./blocktrail');
var walletSDK = require('./wallet');
var _ = require('lodash');
var q = require('q');
var async = require('async');

/**
 *
 * @param backupData
 * @param bitcoinDataClient
 * @param options
 * @constructor
 */
var WalletSweeper = function (backupData, bitcoinDataClient, options) {
    var self = this;
    this.defaultSettings = {
        network: 'btc',
        testnet: false,
        logging: false,
        sweepBatchSize: 200
    };
    this.settings = _.merge({}, this.defaultSettings, options);
    this.utxoFinder = new unspentOutputFinder(bitcoinDataClient, this.settings);
    this.sweepData = null;

    // set the bitcoinlib network
    this.network = this.getBitcoinNetwork(this.settings.network, this.settings.testnet);

    backupData.walletVersion = backupData.walletVersion || 2;   //default to version 2 wallets

    //validate backup data, cleanup input, and prepare seeds
    if (!Array.isArray(backupData.blocktrailKeys)) {
        throw new Error('blocktrail pub keys are required (must be type Array)');
    }
    if (backupData.walletVersion == 1) {
        if (typeof backupData.primaryMnemonic == "undefined" || !backupData.primaryMnemonic) {
            throw new Error('missing primary mnemonic for version 1 wallet');
        }
        if (typeof backupData.backupMnemonic == "undefined" || !backupData.backupMnemonic) {
            throw new Error('missing backup mnemonic for version 1 wallet');
        }
        if (typeof backupData.primaryPassphrase == "undefined") {
            throw new Error('missing primary passphrase for version 1 wallet');
        }

        // cleanup copy paste errors from mnemonics
        backupData.primaryMnemonic = backupData.primaryMnemonic.trim().replace(new RegExp("\r\n", 'g'), " ").replace(new RegExp("\n", 'g'), " ").replace(/\s+/g, " ");
        backupData.backupMnemonic = backupData.backupMnemonic.trim().replace(new RegExp("\r\n", 'g'), " ").replace(new RegExp("\n", 'g'), " ").replace(/\s+/g, " ");
    } else {
        if (typeof backupData.encryptedPrimarySeed == "undefined" || !backupData.encryptedPrimarySeed) {
            throw new Error('missing encrypted primary seed for version 2 wallet');
        }
        if (typeof backupData.backupSeed == "undefined" || !backupData.backupSeed) {
            throw new Error('missing backup seed for version 2 wallet');
        }
        if (typeof backupData.passwordEncryptedSecret == "undefined" || !backupData.passwordEncryptedSecret) {
            throw new Error('missing password encrypted secret for version 2 wallet');
        }
        if (typeof backupData.password == "undefined") {
            throw new Error('missing primary passphrase for version 2 wallet');
        }

        // cleanup copy paste errors from mnemonics
        backupData.encryptedPrimarySeed = backupData.encryptedPrimarySeed.trim().replace(new RegExp("\r\n", 'g'), " ").replace(new RegExp("\n", 'g'), " ").replace(/\s+/g, " ");
        backupData.backupSeed = backupData.backupSeed.trim().replace(new RegExp("\r\n", 'g'), " ").replace(new RegExp("\n", 'g'), " ").replace(/\s+/g, " ");
        backupData.passwordEncryptedSecret = backupData.passwordEncryptedSecret.trim().replace(new RegExp("\r\n", 'g'), " ").replace(new RegExp("\n", 'g'), " ").replace(/\s+/g, " ");
    }


    //create BIP32 HDNodes for the Blocktrail public keys
    this.blocktrailPublicKeys = {};
    _.each(backupData.blocktrailKeys, function(blocktrailKey, index) {
        self.blocktrailPublicKeys[blocktrailKey['keyIndex']] = bitcoin.HDNode.fromBase58(blocktrailKey['pubkey'], self.network);
    });

    var primarySeed, backupSeed;
    if (backupData.walletVersion == 1) {
        primarySeed = bip39.mnemonicToSeed(backupData.primaryMnemonic, backupData.primaryPassphrase);
        backupSeed = bip39.mnemonicToSeed(backupData.backupMnemonic, "");
    } else {
        //if a version 2 wallet, need to process backup data a bit more first

        //convert mnemonics to hex (bip39) and then base64
        backupData.passwordEncryptedSecret = blocktrail.convert(bip39.mnemonicToEntropy(backupData.passwordEncryptedSecret), 'hex', 'base64');
        backupData.encryptedPrimarySeed = blocktrail.convert(bip39.mnemonicToEntropy(backupData.encryptedPrimarySeed), 'hex', 'base64');

        //decrypt encryption secret
        var secret = CryptoJS.AES.decrypt(backupData.passwordEncryptedSecret, backupData.password).toString(CryptoJS.enc.Utf8);

        //now finally decrypt the primary seed and convert to buffer (along with backup seed)
        primarySeed = new Buffer(CryptoJS.AES.decrypt(backupData.encryptedPrimarySeed, secret).toString(CryptoJS.enc.Utf8), 'base64');
        backupSeed = bip39.mnemonicToSeed(backupData.backupSeed, "");
    }

    // convert the primary and backup mnemonics to seeds (using BIP39), then create private keys (using BIP32)
    this.primaryPrivateKey = bitcoin.HDNode.fromSeedBuffer(primarySeed, this.network);
    this.backupPrivateKey = bitcoin.HDNode.fromSeedBuffer(backupSeed, this.network);
};


/**
 * returns an appropriate bitcoin-js lib network
 *
 * @param network
 * @param testnet
 * @returns {*[]}
 */
WalletSweeper.prototype.getBitcoinNetwork =  function(network, testnet) {
    switch (network.toLowerCase()) {
        case 'btc':
        case 'bitcoin':
            if (testnet) {
                return bitcoin.networks.testnet;
            } else {
                return bitcoin.networks.bitcoin;
            }
        case 'tbtc':
        case 'bitcoin-testnet':
            return bitcoin.networks.testnet;
        default:
            throw new Error("Unknown network " + network);
    }
};

/**
 * gets the blocktrail pub key for the given path from the stored array of pub keys
 *
 * @param path
 * @returns {boolean}
 */
WalletSweeper.prototype.getBlocktrailPublicKey = function (path) {
    path = path.replace("m", "M");
    var keyIndex = path.split("/")[1].replace("'", "");

    if (!this.blocktrailPublicKeys[keyIndex]) {
        throw new Error("Wallet.getBlocktrailPublicKey keyIndex (" + keyIndex + ") is unknown to us");
    }

    return this.blocktrailPublicKeys[keyIndex];
};

/**
 * generate multisig address and redeem script for given path
 *
 * @param path
 * @returns {{address: *, redeemScript: *}}
 */
WalletSweeper.prototype.createAddress = function (path) {
    //ensure a public path is used
    path = path.replace("m", "M");
    var keyIndex = path.split("/")[1].replace("'", "");

    //derive the primary pub key directly from the primary priv key
    var primaryPubKey = walletSDK.deriveByPath(this.primaryPrivateKey, path, "m");
    //derive the backup pub key directly from the backup priv key (unharden path)
    var backupPubKey = walletSDK.deriveByPath(this.backupPrivateKey, path.replace("'", ""), "m");
    //derive a pub key for this path from the blocktrail pub key
    var blocktrailPubKey = walletSDK.deriveByPath(this.getBlocktrailPublicKey(path), path, "M/" + keyIndex + "'");

    //sort the keys and generate a multisig redeem script and address
    var multisigKeys = walletSDK.sortMultiSigKeys([
        primaryPubKey.pubKey,
        backupPubKey.pubKey,
        blocktrailPubKey.pubKey
    ]);
    var redeemScript = bitcoin.scripts.multisigOutput(2, multisigKeys);
    var scriptPubKey = bitcoin.scripts.scriptHashOutput(redeemScript.getHash());
    var address = bitcoin.Address.fromOutputScript(scriptPubKey, this.network);

    //@todo return as buffers
    return {address: address.toString(), redeem: redeemScript};
};

/**
 * create a batch of multisig addresses
 *
 * @param start
 * @param count
 * @param keyIndex
 * @returns {{}}
 */
WalletSweeper.prototype.createBatchAddresses = function (start, count, keyIndex) {
    var addresses = {};
    var chain = 0;

    for (var i = 0; i < count; i++) {
        //create a path subsequent address
        var path =  "M/" + keyIndex + "'/" + chain + "/" + (start+i);
        var multisig = this.createAddress(path);
        addresses[multisig['address']] = {
            redeem: multisig['redeem'],
            path: path
        };
    }
    return addresses;
};

WalletSweeper.prototype.discoverWalletFunds = function (increment, cb) {
    var self = this;
    var totalBalance = 0;
    var totalUTXOs = 0;
    var totalAddressesGenerated = 0;
    var addressUTXOs = {};    //addresses and their utxos, paths and redeem scripts
    if (typeof increment == "undefined") {
        increment = this.settings.sweepBatchSize;
    }

    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    //for each blocktrail pub key, do fund discovery on batches of addresses
    async.eachSeries(Object.keys(this.blocktrailPublicKeys), function (keyIndex, done) {
        var i = 0;
        var utxos = null;

        async.doWhilst(function(done) {
            //do
            if (self.settings.logging) {
                console.log("generating " + increment + " addresses using blocktrail key index " + keyIndex);
            }
            var addresses = self.createBatchAddresses(i, increment, keyIndex);
            totalAddressesGenerated += Object.keys(addresses).length;

            if (self.settings.logging) {
                console.log("starting fund discovery for " + increment + " addresses...");
            }

            //get the unspent outputs for this batch of addresses
            utxos = null;
            self.utxoFinder.getUTXOs(_.keys(addresses)).done(function(result) {
                utxos = result;
                //save the address utxos, along with relevant path and redeem script
                _.each(utxos, function(outputs, address) {
                    addressUTXOs[address] = {
                        path:   addresses[address]['path'],
                        redeem: addresses[address]['redeem'],
                        utxos:  outputs
                    };
                    totalUTXOs += outputs.length;

                    //add up the total utxo value for all addresses
                    totalBalance = _.reduce(outputs, function (carry, output) {
                        return carry + output['value'];
                    }, totalBalance);

                    if (self.settings.logging) {
                        console.log("found " + outputs.length + " unspent outputs in address " + address);
                    }
                });

                //ready for the next batch
                i += increment;
                done();
            }, function(err) {
                done(err);
            });
        }, function() {
            //while
            return utxos && Object.keys(utxos).length > 0;
        }, function(err) {
            //all done
            if(err) {
                console.log("batch complete, but with errors", err.message);
                //should we stop if an error was encountered?   @todo consider this
                //done(err);
            }
            //ready for next Blocktrail pub key
            done();
        });

    }, function(err) {
        //callback
        if (err) {
            //perhaps we should also reject the promise, and stop everything?
            if (self.settings.logging) {
                console.log("error encountered when discovering funds", err);
            }
        }

        if (self.settings.logging) {
            console.log("finished fund discovery: "+totalBalance+" Satoshi (in "+totalUTXOs+" outputs) found when searching "+totalAddressesGenerated+" addresses");
        }

        self.sweepData = {
            utxos: addressUTXOs,
            count: totalUTXOs,
            balance: totalBalance,
            addressesSearched: totalAddressesGenerated
        };

        //resolve the promise
        deferred.resolve(self.sweepData);
    });

    return deferred.promise;
};

WalletSweeper.prototype.sweepWallet = function (destinationAddress, cb) {
    var self = this;
    var deferred = q.defer();
    deferred.promise.nodeify(cb);

    if (this.settings.logging) {
        console.log("starting wallet sweeping to address " + destinationAddress);
    }
    if (!this.sweepData) {
        //do wallet fund discovery
        this.discoverWalletFunds().done(function(sweepData) {
            if (self.sweepData['balance'] === 0) {
                //no funds found
                deferred.reject("No funds found after searching through " + self.sweepData['addressesSearched'] + " addresses");
                return deferred.promise;
            }

            //create and sign the transaction
            var transaction = self.createTransaction(destinationAddress);
            deferred.resolve(transaction);

        });
    } else {
        if (this.sweepData['balance'] === 0) {
            //no funds found
            deferred.reject("No funds found after searching through " + self.sweepData['addressesSearched'] + " addresses");
            return deferred.promise;
        }

        //create and sign the transaction
        var transaction = self.createTransaction(destinationAddress);
        deferred.resolve(transaction);
    }

    return deferred.promise;
};

WalletSweeper.prototype.createTransaction = function (destinationAddress) {
    var self = this;
    if (this.settings.logging) {
        console.log("Creating transaction to address destinationAddress");
    }

    // create raw transaction
    var rawTransaction = new bitcoin.TransactionBuilder();
    var inputs = [];
    _.each(this.sweepData['utxos'], function(data, address) {
        _.each(data.utxos, function(utxo, index) {
            rawTransaction.addInput(utxo['hash'], utxo['index']);
            inputs.push({
                 txid:         utxo['hash'],
                 vout:         utxo['index'],
                 scriptPubKey: utxo['script_hex'],
                 value:        utxo['value'],
                 address:      address,
                 path:         data['path'],
                 redeemScript: data['redeem']
             });
        });
    });
    if (!rawTransaction) {
        throw new Error("Failed to create raw transaction");
    }

    var sendAmount = self.sweepData['balance'];
    var outputIdx = rawTransaction.addOutput(destinationAddress, sendAmount);

    //estimate the fee and reduce it's value from the output
    var fee = walletSDK.estimateIncompleteTxFee(rawTransaction.tx);
    rawTransaction.tx.outs[outputIdx].value -= fee;

    //sign and return the raw transaction
    return this.signTransaction(rawTransaction, inputs);
};

WalletSweeper.prototype.signTransaction = function (rawTransaction, inputs) {
    var self = this;
    if (this.settings.logging) {
        console.log("Signing transaction");
    }

    //sign the transaction with the private key for each input
    _.each(inputs, function(input, index) {
        //create private keys for signing
        var primaryPrivKey =  walletSDK.deriveByPath(self.primaryPrivateKey, input['path'].replace("M", "m"), "m").privKey;
        var backupPrivKey =  walletSDK.deriveByPath(self.backupPrivateKey, input['path'].replace("'", "").replace("M", "m"), "m").privKey;

        rawTransaction.sign(index, primaryPrivKey, input['redeemScript']);
        rawTransaction.sign(index, backupPrivKey, input['redeemScript']);
    });

    return rawTransaction.build().toHex();
};

module.exports = WalletSweeper;
