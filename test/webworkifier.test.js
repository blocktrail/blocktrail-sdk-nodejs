/* global navigator */
var blocktrailSDK = require('../');
var webworkifier = require('../lib/webworkifier');
var assert = require('assert');
var randomBytes = require('randombytes');

var isNodeJS = !process.browser;
var useWebWorker = require('../lib/use-webworker')();

describe('webworkifier', function() {
    var androidVersionV4 = ((typeof navigator !== "undefined" && navigator.userAgent) || "").match(/Android 4\./);

    if (isNodeJS) {
        it('is not used on NodeJS', function(cb) {
            assert(!useWebWorker);

            cb();
        });
    } else if (androidVersionV4) {
        it('is not used on Android v4.x', function(cb) {
            assert(!useWebWorker);

            cb();
        });
    } else {
        it('can use webworker', function(cb) {
            assert(useWebWorker);

            cb();
        });

        it('can encrypt on webworker', function() {
            var self = {};

            var pt = new Buffer("plaintextdata");
            var pw = new Buffer("passphrase");
            var saltBuf = randomBytes(blocktrailSDK.Encryption.defaultSaltLen);
            var iv = randomBytes(blocktrailSDK.Encryption.ivLenBits / 8);
            var iterations = blocktrailSDK.KeyDerivation.defaultIterations;

            return webworkifier.workify(self, function() {
                return require('../lib/webworker');
            }, {
                method: 'Encryption.encryptWithSaltAndIV',
                pt: pt,
                pw: pw,
                saltBuf: saltBuf,
                iv: iv,
                iterations: iterations
            })
                .then(function(data) {
                    var cipherText = Buffer.from(data.cipherText.buffer);
                    assert(blocktrailSDK.Encryption.decrypt(cipherText, pw).equals(pt));
                });
        });
    }
});
