var assert = require('assert'),
    sjcl = require('sjcl'),
    KeyDerivation = require('./keyderivation'),
    randomBytes = require('crypto').randomBytes;

var Encryption = {
    defaultSaltLen: 32, /* can permit changes, no more than 512 bit (128 bytes) */
    tagLenBits: 128, /* can permit changes */
    ivLenBits: 128,  /* fixed */
    ivLenWords: 128 / 32
};

Encryption.encrypt = function(pt, pw) {
    var salt = randomBytes(this.defaultSaltLen);//sjcl.random.randomWords(this.defaultSaltLen / 32);
    var iv = randomBytes(this.ivLenBits / 8);
    var iterations = KeyDerivation.defaultIterations;
    return this.encryptWithSaltAndIV(pt, pw, salt, iv, iterations);
};

Encryption.encryptWithSaltAndIV = function(pt, pw, saltBuf, iv, iterations) {
    assert(pw instanceof Buffer, 'pw must be provided as a buffer');
    assert(pt instanceof Buffer, 'pt must be provided as a buffer');
    assert(iv instanceof Buffer, 'IV must be provided as a buffer');
    assert(iv.length === 16, 'IV must be exactly 16 bytes');

    var key = sjcl.codec.hex.toBits(KeyDerivation.compute(pw, saltBuf, iterations).toString('hex'));
    pt = sjcl.codec.hex.toBits(pt.toString('hex'));
    iv = sjcl.codec.hex.toBits(iv.toString('hex'));
    var salt = sjcl.codec.hex.toBits(saltBuf.toString('hex'));
    var ct_t = sjcl.mode.gcm.encrypt(new sjcl.cipher.aes(key), pt, iv, salt, this.tagLenBits);

    // salt is words, so words * 4 = bytes, words * 32 = bits
    var saltLen = (salt.length * 4).toString(16);
    if (saltLen.length % 2 !== 0) {
        saltLen = '0' + saltLen;
    }

    var cost = new Buffer(4);
    cost.writeUInt32LE(iterations, 0);

    var ret = ''
        .concat(saltLen)
        .concat(sjcl.codec.hex.fromBits(salt))
        .concat(cost.toString('hex'))
        .concat(sjcl.codec.hex.fromBits(iv))
        .concat(sjcl.codec.hex.fromBits(ct_t));

    // iter || saltLen8 || salt || iv || tag || ct
    return new Buffer(ret, 'hex');
};

Encryption.decrypt = function(ct, pw) {
    assert(ct instanceof Buffer, 'cipherText must be provided as a Buffer');
    assert(pw instanceof Buffer, 'cipherText must be provided as a Buffer');
    var copy = new Buffer(ct, 'hex');

    var c = 0;
    var saltLen = copy.readInt8(c);
    c += 1;
    var salt = copy.slice(1, c + saltLen);
    c += saltLen;
    var iterations = copy.readUInt32LE(c);
    c += 4;
    var iv = copy.slice(c, 16 + c);
    c += 16;
    var ct_t = copy.slice(c);

    // SaltBuf is required for KeyDerivation. Convert to sjcl where required.
    var key = KeyDerivation.compute(pw, salt, iterations);

    salt = sjcl.codec.hex.toBits(salt.toString('hex'));
    ct_t = sjcl.codec.hex.toBits(ct_t.toString('hex'));
    key = sjcl.codec.hex.toBits(key.toString('hex'));
    iv = sjcl.codec.hex.toBits(iv.toString('hex'));

    var output = sjcl.mode.gcm.decrypt(new sjcl.cipher.aes(key), ct_t, iv, salt, this.tagLenBits);
    return new Buffer(sjcl.codec.hex.fromBits(output), 'hex');
};

module.exports = Encryption;
