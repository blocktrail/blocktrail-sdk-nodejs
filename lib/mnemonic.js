var assert = require('assert'),
    bip39 = require('bip39');

var Mnemonic = {
    paddingDummy: '81' /* because salts with length > 128 should be forbidden? */
};

Mnemonic.encode = function(data) {
    assert(data instanceof Buffer, 'Data must be provided as a Buffer');

    var chunkSize = 4;
    var padLen = chunkSize - data.length % chunkSize;
    var padding = '';
    for (var i = 0; i < padLen; i++) {
        padding += this.paddingDummy;
    }

    var m = bip39.entropyToMnemonic(padding + data.toString('hex'));
    bip39.mnemonicToEntropy(m);
    return m;
};

Mnemonic.decode = function(mnemonic) {
    assert(typeof mnemonic === 'string', 'Mnemonic must be provided as a string');

    var str = bip39.mnemonicToEntropy(mnemonic);
    var padFinish = 0;
    for (var i = 0; padFinish === 0 && i < str.length; i += 2) {
        if (str.slice(i, i + 2) !== this.paddingDummy) {
            padFinish = i;
        }
    }

    return new Buffer(str.slice(padFinish), 'hex');
};

module.exports = Mnemonic;
