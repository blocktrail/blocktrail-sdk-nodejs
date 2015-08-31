var APIClient = require('./lib/api_client');
var blocktrail = require('./lib/blocktrail');

Object.keys(blocktrail).forEach(function(key) {
    APIClient[key] = blocktrail[key];
});

/*
 * we used APIClient as base export so that people can client require('blocktrail')
 *  but that's deprecated and they should require('blocktrail').BlocktrailSDK now, but leaving it for now
 */

APIClient.BlocktrailSDK = APIClient;
APIClient.Wallet = require('./lib/wallet');
APIClient.BackupGenerator = require('./lib/backup_generator');
APIClient.Request = require('./lib/request');

// expose these for using in the browser
APIClient.randomBytes = require('randombytes');
APIClient.lodash = require('lodash');
APIClient.CryptoJS = require('crypto-js');
APIClient.debug = require('debug');
APIClient.bip39 = require('bip39');
APIClient.bitcoin = require('bitcoinjs-lib');

exports = module.exports = APIClient;
