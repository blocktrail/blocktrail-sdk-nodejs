var unspentOutputFinder = require('./unspent_output_finder');
var bitcoin = require('bitcoinjs-lib');
var bip39 = require("bip39");
var blocktrailSDK = require('./api_client');
var walletSDK = require('./wallet');
var _ = require('lodash');

/**
 *
 * @param primaryMnemonic
 * @param primaryPassphrase
 * @param backupMnemonic
 * @param blocktrailPublicKeys
 * @param bitcoinDataClient
 * @param options
 * @constructor
 */
var WalletSweeper = function (primaryMnemonic, primaryPassphrase, backupMnemonic, blocktrailPublicKeys, bitcoinDataClient, options) {
    var self = this;
    this.defaultSettings = {
        network: 'btc',
        testnet: false,
        logging: false
    };
    this.settings = _.merge({}, this.defaultSettings, options);
    this.utxoFinder = new unspentOutputFinder(bitcoinDataClient);

    // set the bitcoinlib network
    this.network = this.getBitcoinNetwork(this.settings.network, this.settings.testnet);


    //create BIP32 HDNodes for the Blocktrail public keys
    this.blocktrailPublicKeys = {};
    _.each(blocktrailPublicKeys, function(blocktrailKey, index) {
        //@todo is this correct?
        self.blocktrailPublicKeys[blocktrailKey['keyIndex']] = bitcoin.HDNode.fromBase58(blocktrailKey['pubkey'], self.network);
    });

    // cleanup copy paste errors from mnemonics
    this.primaryMnemonic = primaryMnemonic.trim().replace("  ", " ").replace("\r\n", " ").replace("\n", " ");
    this.backupMnemonic = backupMnemonic.trim().replace("  ", " ").replace("\r\n", " ").replace("\n", " ");


    // convert the primary and backup mnemonics to seeds (using BIP39), then create private keys (using BIP32)
    var primarySeed = bip39.mnemonicToSeed(primaryMnemonic, primaryPassphrase);
    var backupSeed = bip39.mnemonicToSeed(backupMnemonic, "");
    this.primaryPrivateKey = bitcoin.HDNode.fromSeedBuffer(primarySeed, this.network);
    this.backupPrivateKey = bitcoin.HDNode.fromSeedBuffer(backupSeed, this.network);

    //nocommit
    /*
    console.log(this.primaryPrivateKey + "");
    console.log(this.backupPrivateKey + "");
    console.log(this.blocktrailPublicKeys[0]);
    console.log(this.blocktrailPublicKeys[9999] + "");
    */
};

/**
 * returns an appropriate bitcoinjs lib network
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
    path = path.replace("m", "M");                      //ensure a public path is used
    var keyIndex = path.split("/")[1].replace("'", "");

    //create public primary key from private key first, then derive pub key for this path
    var primaryPubKey = walletSDK.deriveByPath(this.primaryPrivateKey, "M/" + keyIndex + "'", "m");
    primaryPubKey = walletSDK.deriveByPath(primaryPubKey, path, "M/" + keyIndex + "'");

    //derive the backup pub key directly from the backup priv key
    //create public backup key from private key, then derive pub key for this path
    var backupPubKey = walletSDK.deriveByPath(this.backupPrivateKey, "M", "m");
    backupPubKey = walletSDK.deriveByPath(backupPubKey, path.replace("'", ""), "M");

    //derive a pub key for this path from the blocktrail pub key
    var blocktrailPubKey = walletSDK.deriveByPath(this.getBlocktrailPublicKey(path), path, "M/" + keyIndex + "'");

    //sort the keys and generate a multisig script and address
    var multisigKeys = walletSDK.sortMultiSigKeys([
        primaryPubKey.pubKey,
        backupPubKey.pubKey,
        blocktrailPubKey.pubKey
    ]);
    var redeemScript = bitcoin.scripts.multisigOutput(2, multisigKeys);

    //var redeemScript = self.getRedeemScriptByPath(path);
    var scriptPubKey = bitcoin.scripts.scriptHashOutput(redeemScript.getHash());
    var address = bitcoin.Address.fromOutputScript(scriptPubKey, this.network);

    /*
    console.log(primaryPubKey.toString());
    console.log(backupPubKey.toString());
    console.log(blocktrailPubKey.toString());
    */

    return {address: address.toString(), redeemScript: redeemScript};

    //return [multiSig['address'], multiSig['redeemScript']];
};

WalletSweeper.prototype.createBatchAddresses = function (start, count, keyIndex) {
};

WalletSweeper.prototype.discoverWalletFunds = function (increment) {
};

WalletSweeper.prototype.sweepWallet = function (destinationAddress, sweepBatchSize) {
};

WalletSweeper.prototype.createTransaction = function (destinationAddress) {
};

WalletSweeper.prototype.signTransaction = function (rawTransaction, inputs) {
};

module.exports = WalletSweeper;
