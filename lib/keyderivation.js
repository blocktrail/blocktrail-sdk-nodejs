var assert = require('assert'),
    sjcl = require('sjcl');

var KeyDerivation = {
    defaultIterations: 35000,
    keySizeBits: 256
};

var hmacSha512 = function(key) {
    var hasher = new sjcl.misc.hmac(key, sjcl.hash.sha512);
    this.encrypt = function() {
        return hasher.encrypt.apply(hasher, arguments);
    };
};

KeyDerivation.compute = function(pw, salt, iterations) {
    iterations = iterations || this.defaultIterations;
    assert(pw instanceof Buffer, 'Password must be provided as a Buffer');
    assert(salt instanceof Buffer, 'Salt must be provided as a Buffer');
    assert(salt.length > 0, 'Salt must not be empty');
    assert(typeof iterations === 'number', 'Iterations must be a number');
    assert(iterations >= 512, 'Iteration count should be at least 512');

    salt = sjcl.codec.hex.toBits(salt.toString('hex'));
    var data = sjcl.codec.hex.toBits(pw.toString('hex'));

    var expanded = sjcl.misc.pbkdf2(data, salt, iterations, this.keySizeBits, hmacSha512);
    return new Buffer(sjcl.codec.hex.fromBits(expanded), 'hex');
};

module.exports = KeyDerivation;
