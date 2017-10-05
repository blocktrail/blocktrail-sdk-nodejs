/* jshint -W101, -W098 */
/* global window */
var _ = require('lodash');
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

var multisigFixtures = (function () {
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
    multisigFixtures.map(function (fixture) {
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
});
