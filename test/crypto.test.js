var blocktrail = require('../'),
    assert = require('assert'),
    bitcoin = blocktrail.bitcoin,
    rbg = require('crypto').randomBytes;
var V3Crypt = blocktrail.V3Crypt;
var Wallet = blocktrail.Wallet;
var _ = require('lodash');
var vectors = require('./vectors');

var randomBytes = function(len) {
    return new Buffer(rbg(len));
};

describe('key derivation', function() {
    _.forEach(vectors.keyderivation, function(vector, key) {
        it('vector ' + key + ' produces the right key', function() {
            var password = new Buffer(vector.password, 'hex');
            var salt = new Buffer(vector.salt, 'hex');
            var iterations = vector.iterations;
            var output = V3Crypt.KeyDerivation.compute(password, salt, iterations);

            assert.equal(output.toString('hex'), vector.output);
        });
    });
});

describe('encryption', function() {
    _.forEach(vectors.encryption, function(vector, key) {
        it('vector ' + key + ' demonstrates properties of GCM', function() {
            var pw = new Buffer(vector.password, 'hex');
            var pt = new Buffer(vector.pt, 'hex');
            var salt = new Buffer(vector.salt, 'hex');
            var iv = new Buffer(vector.iv, 'hex');
            var iterations = vector.iterations;

            // test output given this pt/pw/salt/iv matches the test vector
            var firstEncrypt = V3Crypt.Encryption.encryptWithSaltAndIV(pt, pw, salt, iv, iterations);
            assert.equal(firstEncrypt.toString('hex'), vector.full, 'gcm output should match given pt/pw/salt/iv');

            // test we can decrypt it again
            var firstDecrypt = V3Crypt.Encryption.decrypt(firstEncrypt, pw);
            assert.equal(firstDecrypt.toString(), pt.toString(), 'encryption/decryption should be consistent');
        });
    });
});

describe('mnemonic', function() {
    _.forEach(vectors.mnemonic, function(vector, key) {
        it('vector ' + key + ' can be encoded & decoded', function() {
            var data = new Buffer(vector.data, 'hex');
            var mnemonic = vector.mnemonic;
            assert.equal(V3Crypt.EncryptionMnemonic.encode(data), mnemonic);
            assert.equal(V3Crypt.EncryptionMnemonic.decode(mnemonic).toString(), data.toString());
        });
    });
});

describe('wallet', function() {
    _.forEach(vectors.password_reset_case, function(f) {
        it('should allow password RESET', function() {
            var expectedSecret = new Buffer(f.expectedSecret, 'hex');

            // user lost passphrase, has backup sheet
            var recoverySecret = new Buffer(f.recoverySecret,'hex');
            //  ^ this comes from Blocktrail

            var recoveryEncryptedSecret = f.recoveryEncryptedMnemonic;
            //  ^ the user keeps this

            var decodedRS = V3Crypt.EncryptionMnemonic.decode(recoveryEncryptedSecret);
            var decryptedSecret = V3Crypt.Encryption.decrypt(decodedRS, recoverySecret);
            assert.equal(decryptedSecret.toString('hex'), expectedSecret.toString('hex'));
        });
    });


    it('uses secret to decrypt primarySeed', function() {
        _.forEach(vectors.decryptonly, function(vector, key) {
            it ('vector ' + key + ' should decrypt and produce the same checksum', function() {
                var passphrase = new Buffer(vector.password, 'hex');
                var encryptedSecretMnemonic = vector.encryptedSecret;
                var primaryEncryptedSeedMnemonic = vector.primaryEncryptedSeed;

                var decodedSecret = V3Crypt.EncryptionMnemonic.decode(encryptedSecretMnemonic);
                var decryptedSecret = V3Crypt.Encryption.decrypt(decodedSecret, passphrase);

                var decodedPrimarySeed = V3Crypt.EncryptionMnemonic.decode(primaryEncryptedSeedMnemonic);
                var decryptedPrimarySeed = V3Crypt.Encryption.decrypt(decodedPrimarySeed, decryptedSecret);

                var node = bitcoin.HDNode.fromSeedBuffer(decryptedPrimarySeed);
                assert.equal(node.getAddress(), vector.checksum);
            });
        });
    });

    it('encryption should produce valid encryption of the wallet seed', function() {
        this.timeout(0);
        var passphrase = new Buffer('S2SZKBjdLwfnpesqEw9DNbaCvM2X8s9GmBcKfqBkrHtNYA8XQ5nfhzDgnT5aq5HedEYXhn3nbtpukzxaGgB2cxxBCkJJdBQJ');
        var primarySeed = randomBytes(Wallet.WALLET_ENTROPY_BITS / 8);

        var secret = randomBytes(Wallet.WALLET_ENTROPY_BITS / 8);
        var encryptedSecret = V3Crypt.Encryption.encrypt(secret, passphrase);
        assert.equal(secret.toString(), V3Crypt.Encryption.decrypt(encryptedSecret, passphrase).toString());

        var encryptedPrimarySeed = V3Crypt.Encryption.encrypt(primarySeed, passphrase);
        assert.equal(primarySeed.toString(), V3Crypt.Encryption.decrypt(encryptedPrimarySeed, passphrase).toString());

        var recoverySecret = randomBytes(Wallet.WALLET_ENTROPY_BITS / 8);
        var recoveryEncryptedSecret = V3Crypt.Encryption.encrypt(secret, recoverySecret);
        assert.equal(secret.toString(), V3Crypt.Encryption.decrypt(recoveryEncryptedSecret, recoverySecret).toString());

        var backupInfo = {
            encryptedPrimarySeed: V3Crypt.EncryptionMnemonic.encode(encryptedPrimarySeed),
            encryptedSecret: V3Crypt.EncryptionMnemonic.encode(encryptedSecret),
            recoveryEncryptedSecret: V3Crypt.EncryptionMnemonic.encode(recoveryEncryptedSecret)
        };

        _.forEach(backupInfo, function(val, key) {
            var cmp;
            if (key === 'encryptedPrimarySeed') {
                cmp = encryptedPrimarySeed;
            } else if (key === 'encryptedSecret') {
                cmp = encryptedSecret;
            } else if (key === 'recoveryEncryptedSecret') {
                cmp = recoveryEncryptedSecret;
            }

            assert.equal(cmp.toString(), V3Crypt.EncryptionMnemonic.decode(val).toString());
        });
    });
});
