/* jshint -W101, -W098 */
/* global window */
var assert = require('assert');
var bitcoin = require('bitcoinjs-lib');
var SizeEstimation = require("../lib/size_estimation");

var varIntFixtures = [
    [0, 1],
    [1, 1],
    [252, 1],
    [253, 3],
    [254, 3],
    [65534, 3],
    [65535, 5],
    [65536, 5],
    [Math.pow(2, 31), 5],
    [Math.pow(2, 32)-2, 5],
    [Math.pow(2, 32)-1, 9],
    [Math.pow(2, 32), 9],

    // don't go above this, is signed int territory, PHP complains
    // nodejs?
    [0x7fffffffffffffff, 9]
];

var scriptDataLenFixtures =  [
    [0, 1],
    [1, 1],
    [74, 1],
    [75, 2],
    [76, 2],
    [254, 2],
    [255, 2],
    [256, 3],
    [65534, 3],
    [65535, 3],
    [65536, 5]
];

var multisigStackFixtures = (function () {
    var u = ['5KW8Ymmu8gWManGggZZQJeX7U3pn5HtcqqsVrNUbc1SUmVPZbwp',
        '5KCV94YBsrJWTdk6cQWJxEd25sH8h1cGTpJnCN6kLMLe4c3QZVr',
        '5JUxGateMWVBsBQkAwSRQLxyaQXhsch4EStfC62cqdEf2zUheVT'
    ];
    var c = ['L1Tr4rPUi81XN1Dp48iuva5U9sWxU1eipgiAu8BhnB3xnSfGV5rd',
        'KwUZpCvpAkUe1SZj3k3P2acta1V1jY8Dpuj71bEAukEKVrg8NEym',
        'Kz2Lm2hzjPWhv3WW9Na5HUKi4qBxoTfv8fNYAU6KV6TZYVGdK5HW'
    ];
    var uncompressed = u.map(function (wif) {
        return bitcoin.ECPair.fromWIF(wif, bitcoin.networks.bitcoin);
    });
    var compressed = c.map(function (wif) {
        return bitcoin.ECPair.fromWIF(wif, bitcoin.networks.bitcoin);
    });

    var fixtures = [];
    for (var i = 0; i < 3; i++) {
        var keys = [];
        for (var j = 0; j < i; j++) {
            keys.push(uncompressed[j].getPublicKeyBuffer());
        }
        for (var j = i; j < 3; j++) {
            keys.push(compressed[j].getPublicKeyBuffer());
        }

        fixtures.push([bitcoin.script.multisig.output.encode(2, keys)]);
    }

    return fixtures;
})();

// test fixtures of every possible representation of multisig
var multisigFormFixtures = (function () {
    var c = ['L1Tr4rPUi81XN1Dp48iuva5U9sWxU1eipgiAu8BhnB3xnSfGV5rd',
        'KwUZpCvpAkUe1SZj3k3P2acta1V1jY8Dpuj71bEAukEKVrg8NEym',
        'Kz2Lm2hzjPWhv3WW9Na5HUKi4qBxoTfv8fNYAU6KV6TZYVGdK5HW'
    ];
    var keys = c.map(function (wif) {
        return bitcoin.ECPair.fromWIF(wif, bitcoin.networks.bitcoin).getPublicKeyBuffer();
    });
    var multisig = bitcoin.script.multisig.output.encode(2, keys);
    var bareSize = 1/*op0*/ + 2*(1+SizeEstimation.SIZE_DER_SIGNATURE);

    var bareSig = 1 + bareSize;
    var p2shSig = 3 + bareSize + 2 + multisig.length;

    var p2wshHash = bitcoin.crypto.sha256(multisig);
    var p2wshScript = bitcoin.script.witnessScriptHash.output.encode(p2wshHash);

    var nestedSig = 1 + 1 + p2wshScript.length;
    var witSize = 1 + 2*(1+SizeEstimation.SIZE_DER_SIGNATURE);
    var nestedWit = witSize + 1 + 1 + multisig.length;

    return [
        [multisig, false, null, null, bareSig, 0],
        [multisig, false, multisig, null, p2shSig, 0],
        [multisig, true, null, multisig, 1, nestedWit],
        [multisig, true, p2wshScript, multisig, nestedSig, nestedWit]
    ];
})();

varIntFixtures.map(function (fixture) {
    var inputLen = fixture[0];
    var expectSize = fixture[1];
    describe('getLengthForVarInt', function (cb) {
        it('works for `' + inputLen + '` (equals ' + expectSize + ')', function (cb) {
            var result = SizeEstimation.getLengthForVarInt(inputLen);
            assert.equal(expectSize, result);
            cb()
        });
    });
});

scriptDataLenFixtures.map(function (fixture) {
    var inputLen = fixture[0];
    var expectSize = fixture[1];
    describe('getLengthForScriptPush', function () {
        it(' works for '+ inputLen + '` (equals '+ expectSize+')', function (cb) {
            var result = SizeEstimation.getLengthForScriptPush(inputLen);
            assert.equal(expectSize, result);
            cb()
        });
    });
});

describe("estimateMultisigStackSize", function () {
    multisigStackFixtures.map(function (fixture) {
        it("works for multisig scripts with the keys", function () {
            var script = fixture[0];
            assert.ok(bitcoin.script.multisig.output.check(script));
            var decoded = bitcoin.script.multisig.output.decode(script);
            var estimation = SizeEstimation.estimateMultisigStackSize(decoded.m, decoded.pubKeys);

            assert.equal("object", typeof estimation);
            assert.equal(2, estimation.length);

            var scriptSize = estimation[1];
            assert.equal(script.length, scriptSize);

            var stackSizes = estimation[0];
            assert.equal(1+decoded.m, stackSizes.length)
            assert.equal(0, stackSizes[0])
            for (var i = 0; i < decoded.m; i++) {
                assert.equal(SizeEstimation.SIZE_DER_SIGNATURE, stackSizes[1+i]);
            }
        })
    });

    multisigFormFixtures.map(function (fixture) {
        it("deals with different representations", function () {
            var script = fixture[0];
            var isWit = fixture[1];
            var rs = fixture[2];
            var ws = fixture[3];
            var expectSig = fixture[4];
            var expectWit = fixture[5];

            assert.ok(bitcoin.script.multisig.output.check(script));
            var multisig = bitcoin.script.multisig.output.decode(script);

            var stackEst = SizeEstimation.estimateMultisigStackSize(multisig.m, multisig.pubKeys);
            var stackSizes = stackEst[0];

            var est = SizeEstimation.estimateStackSignatureSize(stackSizes, isWit, rs, ws);
            assert.equal("object", typeof est);
            assert.equal(2, est.length);

            var foundSigSize = est[0];
            var foundWitSize = est[1];

            assert.equal(foundSigSize, expectSig);
            assert.equal(foundWitSize, expectWit);
        })
    });
});
