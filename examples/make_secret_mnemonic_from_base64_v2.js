var blocktrail = require('../');
var bip39 = require('bip39');
var q = require('q');

(function(EPS) {
    // note: EPS is an object, and when converted to a string it will
    // end with a linefeed.  so we (rather crudely) account for that
    // with toString() and then trim()
    var base64 = EPS.toString().trim();
    console.log(base64);
    console.log(blocktrail.convert(base64, 'base64', 'hex'));

    var mnemonic = bip39.entropyToMnemonic(blocktrail.convert(base64, 'base64', 'hex'));
    var lastTwo = mnemonic.split(" ").slice(-2);
    console.log(mnemonic);
    console.log(lastTwo);
    process.exit(0);
})("U...V2 PES");
