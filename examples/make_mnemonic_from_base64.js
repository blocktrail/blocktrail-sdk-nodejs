var blocktrail = require('../'); // require('blocktrail-sdk') when trying example from in your own project

var EncryptionMnemonic = require('./../lib/encryption_mnemonic');
var bip39 = require('bip39');

var base64 = 'Cj9xxxxxxxxxxxxxxxxx==';

var mnemonic = EncryptionMnemonic.encode(Buffer.from(base64, 'base64'));
console.log(mnemonic);
