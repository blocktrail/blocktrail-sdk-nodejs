/* jshint -W101, -W098 */
/* global window */
var assert = require('assert');
var bitcoin = require('bitcoinjs-lib');
var SizeEstimation = require("../lib/size_estimation");

function makeUtxo(script, rs, ws) {
    var utxo = {
        scriptpubkey_hex: script.toString('hex'),
        value: 100000000
    };
    if (rs instanceof Buffer) {
        utxo.redeem_script = rs.toString('hex');
    }
    if (ws instanceof Buffer) {
        utxo.witness_script = ws.toString('hex');
    }
    return utxo;
}

function scriptUtxos(script) {
    var hash160 = bitcoin.crypto.hash160(script);
    var p2shSPK = bitcoin.script.scriptHash.output.encode(hash160);

    var sha256 = bitcoin.crypto.sha256(script);
    var p2wshSPK = bitcoin.script.witnessScriptHash.output.encode(sha256);

    var p2wshHash160 = bitcoin.crypto.hash160(p2wshSPK);
    var p2wshP2sh = bitcoin.script.scriptHash.output.encode(p2wshHash160);

    var bareUtxo = makeUtxo(script, null, null);
    var p2shUtxo = makeUtxo(p2shSPK, script, null);
    var p2wshUtxo = makeUtxo(p2wshSPK, null, script);
    var p2shP2wshUtxo = makeUtxo(p2wshP2sh, p2wshSPK, script);

    return {
        bareUtxo: bareUtxo,
        p2shUtxo: p2shUtxo,
        p2wshUtxo: p2wshUtxo,
        p2shP2wshUtxo: p2shP2wshUtxo
    };
}

function makeUtxoFixtures(script, scriptSizes, extra) {
    var utxos = scriptUtxos(script);
    var result = [
        [utxos.bareUtxo, scriptSizes.bareSig, 0],
        [utxos.p2shUtxo, scriptSizes.p2shSig, 0],
        [utxos.p2wshUtxo, 1, scriptSizes.nestedWit],
        [utxos.p2shP2wshUtxo, scriptSizes.nestedSig, scriptSizes.nestedWit]
    ];

    if (Array.isArray(extra) && extra.length > 0) {
        for (var i = 0; i < result.length; i++) {
            result[i] = result[i].concat(extra);
        }
    }

    return result;
}

function makeFormFixtures(script, scriptSizes, extra) {
    var result = [
        [script, false, null, null, scriptSizes.bareSig, 0],
        [script, false, script, null, scriptSizes.p2shSig, 0],
        [script, true, null, script, 1, scriptSizes.nestedWit],
        [script, true, scriptSizes.p2wshScript, script, scriptSizes.nestedSig, scriptSizes.nestedWit]
    ];

    if (Array.isArray(extra) && extra.length > 0) {
        for (var i = 0; i < result.length; i++) {
            result[i] = result[i].concat(extra);
        }
    }

    return result;
}

function p2pkScriptSizes(script) {
    var bareSize = (1 + SizeEstimation.SIZE_DER_SIGNATURE);
    var bareSig = 1 + bareSize;
    var p2shSig = 1 + bareSize + 1 + script.length;

    var p2wshHash = bitcoin.crypto.sha256(script);
    var p2wshScript = bitcoin.script.witnessScriptHash.output.encode(p2wshHash);

    var nestedSig = 1 + 1 + p2wshScript.length;
    var witSize = (1 + SizeEstimation.SIZE_DER_SIGNATURE);
    var nestedWit = witSize + 1 + 1 + script.length;

    return {
        bareSig: bareSig,
        p2shSig: p2shSig,
        p2wshScript: p2wshScript,
        nestedSig: nestedSig,
        nestedWit: nestedWit
    };
}

function p2pkMakeScript(wif, network) {
    var uncompressed = bitcoin.ECPair.fromWIF(wif, network);
    var keyu = uncompressed.getPublicKeyBuffer();
    return bitcoin.script.pubKey.output.encode(keyu);
}

function p2pkhScriptSizes(script, compressed) {
    var bareSize = (1 + SizeEstimation.SIZE_DER_SIGNATURE) + (1 + (compressed ? 33 : 65));
    var bareSig = 1 + bareSize;
    var p2shSig = 1 + bareSize + 1 + script.length;

    var p2wshHash = bitcoin.crypto.sha256(script);
    var p2wshScript = bitcoin.script.witnessScriptHash.output.encode(p2wshHash);

    var nestedSig = 1 + 1 + p2wshScript.length;
    var witSize = (1 + SizeEstimation.SIZE_DER_SIGNATURE) + (1 + (compressed ? 33 : 65));
    var nestedWit = witSize + 1 + 1 + script.length;

    return {
        bareSig: bareSig,
        p2shSig: p2shSig,
        p2wshScript: p2wshScript,
        nestedSig: nestedSig,
        nestedWit: nestedWit
    };
}

function p2pkhMakeScript(wif, network) {
    var eckey = bitcoin.ECPair.fromWIF(wif, network);
    var hash160 = bitcoin.crypto.hash160(eckey.getPublicKeyBuffer());
    return bitcoin.script.pubKeyHash.output.encode(hash160);
}

function p2pkhFormFixture(wif, network) {
    var keyHash = p2pkhMakeScript(wif, network);
    var compressed = bitcoin.ECPair.fromWIF(wif, network).compressed;
    var scriptSizes = p2pkhScriptSizes(keyHash, compressed);
    return makeFormFixtures(keyHash, scriptSizes, [compressed]);
}

function p2pkMakeFormFixtures(wif, network) {
    var script = p2pkMakeScript(wif, network);
    var scriptSizes = p2pkScriptSizes(script);
    return makeFormFixtures(script, scriptSizes);
}
function multisigMakeScript(m, wifs, network) {
    var keys = wifs.map(function(wif) {
        return bitcoin.ECPair.fromWIF(wif, network).getPublicKeyBuffer();
    });

    return bitcoin.script.multisig.output.encode(m, keys);
}
function multisigScriptSizes(m, script) {
    var bareSize = 1/*op0*/ + m * (1 + SizeEstimation.SIZE_DER_SIGNATURE);
    var bareSig = 1 + bareSize;
    var p2shSig = bareSize + SizeEstimation.getLengthForScriptPush(script.length) + script.length;

    var p2wshHash = bitcoin.crypto.sha256(script);
    var p2wshScript = bitcoin.script.witnessScriptHash.output.encode(p2wshHash);

    var nestedSig = 1 + 1 + p2wshScript.length;
    var witSize = 1 + m * (1 + SizeEstimation.SIZE_DER_SIGNATURE);
    var nestedWit = witSize + 1 + 1 + script.length;

    return {
        bareSig: bareSig,
        p2shSig: SizeEstimation.getLengthForVarInt(p2shSig) + p2shSig,
        p2wshScript: p2wshScript,
        nestedSig: nestedSig,
        nestedWit: nestedWit
    };
}

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
    [Math.pow(2, 32) - 2, 5],
    [Math.pow(2, 32) - 1, 9],
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

var p2pkStackFixtures = (function() {
    var u = '5KW8Ymmu8gWManGggZZQJeX7U3pn5HtcqqsVrNUbc1SUmVPZbwp';
    var c = 'L1Tr4rPUi81XN1Dp48iuva5U9sWxU1eipgiAu8BhnB3xnSfGV5rd';

    var fixtures = [];

    fixtures.push([p2pkMakeScript(u, bitcoin.networks.bitcoin)]);
    fixtures.push([p2pkMakeScript(c, bitcoin.networks.bitcoin)]);

    return fixtures;
})();

// test fixtures of every possible representation of multisig
var p2pkFormFixtures = (function() {
    return []
        .concat(p2pkMakeFormFixtures('5KW8Ymmu8gWManGggZZQJeX7U3pn5HtcqqsVrNUbc1SUmVPZbwp', bitcoin.networks.bitcoin))
        .concat(p2pkMakeFormFixtures('L1Tr4rPUi81XN1Dp48iuva5U9sWxU1eipgiAu8BhnB3xnSfGV5rd', bitcoin.networks.bitcoin));
})();

var p2pkhStackFixtures = (function() {
    var u = '5KW8Ymmu8gWManGggZZQJeX7U3pn5HtcqqsVrNUbc1SUmVPZbwp';
    var c = 'L1Tr4rPUi81XN1Dp48iuva5U9sWxU1eipgiAu8BhnB3xnSfGV5rd';

    var fixtures = [];
    fixtures.push([p2pkhMakeScript(u, bitcoin.networks.bitcoin)]);
    fixtures.push([p2pkhMakeScript(c, bitcoin.networks.bitcoin)]);

    return fixtures;
})();

// test fixtures of every possible representation of multisig
var p2pkhFormFixtures = (function() {

    return []
        .concat(p2pkhFormFixture('L1Tr4rPUi81XN1Dp48iuva5U9sWxU1eipgiAu8BhnB3xnSfGV5rd', bitcoin.networks.bitcoin))
        .concat(p2pkhFormFixture('5KW8Ymmu8gWManGggZZQJeX7U3pn5HtcqqsVrNUbc1SUmVPZbwp', bitcoin.networks.bitcoin))
    ;
})();

var multisigStackFixtures = (function() {
    var u = ['5KW8Ymmu8gWManGggZZQJeX7U3pn5HtcqqsVrNUbc1SUmVPZbwp',
        '5KCV94YBsrJWTdk6cQWJxEd25sH8h1cGTpJnCN6kLMLe4c3QZVr',
        '5JUxGateMWVBsBQkAwSRQLxyaQXhsch4EStfC62cqdEf2zUheVT'
    ];
    var c = ['L1Tr4rPUi81XN1Dp48iuva5U9sWxU1eipgiAu8BhnB3xnSfGV5rd',
        'KwUZpCvpAkUe1SZj3k3P2acta1V1jY8Dpuj71bEAukEKVrg8NEym',
        'Kz2Lm2hzjPWhv3WW9Na5HUKi4qBxoTfv8fNYAU6KV6TZYVGdK5HW'
    ];
    var uncompressed = u.map(function(wif) {
        return bitcoin.ECPair.fromWIF(wif, bitcoin.networks.bitcoin);
    });
    var compressed = c.map(function(wif) {
        return bitcoin.ECPair.fromWIF(wif, bitcoin.networks.bitcoin);
    });

    var fixtures = [];
    for (var i = 0; i < 3; i++) {
        var keys = [];
        var j;
        for (j = 0; j < i; j++) {
            keys.push(uncompressed[j].getPublicKeyBuffer());
        }
        for (j = i; j < 3; j++) {
            keys.push(compressed[j].getPublicKeyBuffer());
        }

        fixtures.push([bitcoin.script.multisig.output.encode(2, keys)]);
    }

    return fixtures;
})();

// test fixtures of every possible representation of multisig
var multisigFormFixtures = (function() {
    var multisig = multisigMakeScript(2, ['L1Tr4rPUi81XN1Dp48iuva5U9sWxU1eipgiAu8BhnB3xnSfGV5rd',
        'KwUZpCvpAkUe1SZj3k3P2acta1V1jY8Dpuj71bEAukEKVrg8NEym',
        'Kz2Lm2hzjPWhv3WW9Na5HUKi4qBxoTfv8fNYAU6KV6TZYVGdK5HW'
    ], bitcoin.networks.bitcoin);

    var msDetail = multisigScriptSizes(2, multisig);

    return []
        .concat(makeFormFixtures(multisig, msDetail));
})();

// test fixtures of every possible representation of multisig
var multisigUtxoFixtures = (function() {
    var data = [
        [
            2,
            [
                'L1Tr4rPUi81XN1Dp48iuva5U9sWxU1eipgiAu8BhnB3xnSfGV5rd',
                'KwUZpCvpAkUe1SZj3k3P2acta1V1jY8Dpuj71bEAukEKVrg8NEym',
                'Kz2Lm2hzjPWhv3WW9Na5HUKi4qBxoTfv8fNYAU6KV6TZYVGdK5HW'
            ],
            bitcoin.networks.bitcoin
        ],
        [
            3,
            [
                'L1Tr4rPUi81XN1Dp48iuva5U9sWxU1eipgiAu8BhnB3xnSfGV5rd',
                'KwUZpCvpAkUe1SZj3k3P2acta1V1jY8Dpuj71bEAukEKVrg8NEym',
                'Kz2Lm2hzjPWhv3WW9Na5HUKi4qBxoTfv8fNYAU6KV6TZYVGdK5HW'
            ],
            bitcoin.networks.bitcoin
        ],
        [
            1,
            [
                'L1Tr4rPUi81XN1Dp48iuva5U9sWxU1eipgiAu8BhnB3xnSfGV5rd'
            ],
            bitcoin.networks.bitcoin
        ]
    ];

    var fixtures = [];
    data.map(function(fixture) {
        var script = multisigMakeScript(fixture[0], fixture[1], fixture[2]);
        var msDetail = multisigScriptSizes(fixture[0], script);
        makeUtxoFixtures(script, msDetail).map(function(fixture) {
            fixtures.push(fixture);
        });
    });

    return fixtures;
})();

// test fixtures of every possible representation of multisig
var p2pkUtxoFixtures = (function() {
    var data = [
        [
            'L1Tr4rPUi81XN1Dp48iuva5U9sWxU1eipgiAu8BhnB3xnSfGV5rd',
            bitcoin.networks.bitcoin
        ],
        [
            'KwUZpCvpAkUe1SZj3k3P2acta1V1jY8Dpuj71bEAukEKVrg8NEym',
            bitcoin.networks.bitcoin
        ],
        [
            'Kz2Lm2hzjPWhv3WW9Na5HUKi4qBxoTfv8fNYAU6KV6TZYVGdK5HW',
            bitcoin.networks.bitcoin
        ]
    ];

    var fixtures = [];
    data.map(function(fixture) {
        var script = p2pkMakeScript(fixture[0], fixture[1]);
        var msDetail = p2pkScriptSizes(script);
        makeUtxoFixtures(script, msDetail).map(function(fixture) {
            fixtures.push(fixture);
        });
    });

    return fixtures;
})();

// test fixtures of every possible representation of multisig
var p2pkhUtxoFixtures = (function() {
    var data = [
        [
            'L1Tr4rPUi81XN1Dp48iuva5U9sWxU1eipgiAu8BhnB3xnSfGV5rd',
            bitcoin.networks.bitcoin
        ]
    ];

    var fixtures = [];
    data.map(function(fixture) {
        var script = p2pkhMakeScript(fixture[0], fixture[1]);
        var compressed = bitcoin.ECPair.fromWIF(fixture[0], fixture[1]).compressed;
        var msDetail = p2pkhScriptSizes(script, compressed);
        makeUtxoFixtures(script, msDetail, [compressed]).map(function(fixture) {
            fixtures.push(fixture);
        });
    });

    return fixtures;
})();

describe('SizeEstimation.getLengthForVarInt', function() {
    varIntFixtures.map(function(fixture) {
        var inputLen = fixture[0];
        var expectSize = fixture[1];
        it('works for `' + inputLen + '` (equals ' + expectSize + ')', function(cb) {
            var result = SizeEstimation.getLengthForVarInt(inputLen);
            assert.equal(expectSize, result);
            cb();
        });
    });

    it('throws when too large an input is provided', function(cb) {
        var err;
        try {
            SizeEstimation.getLengthForVarInt(0xffffffffffffffff + 1);
        } catch (e) {
            err = e;
        }

        assert.ok(typeof err === "object");
        assert.equal(err.message, "Size of varint too large");
        cb();
    });
});

describe('SizeEstimation.getLengthForScriptPush', function() {
    scriptDataLenFixtures.map(function(fixture) {
        var inputLen = fixture[0];
        var expectSize = fixture[1];
        it(' works for ' + inputLen + '` (equals ' + expectSize + ')', function(cb) {
            var result = SizeEstimation.getLengthForScriptPush(inputLen);
            assert.equal(expectSize, result);
            cb();
        });
    });

    it('throws when too large an input is provided', function(cb) {
        var err;
        try {
            SizeEstimation.getLengthForScriptPush(0xffffffff + 1);
        } catch (e) {
            err = e;
        }

        assert.ok(typeof err === "object");
        assert.equal(err.message, "Size of pushdata too large");
        cb();
    });
});

describe('estimateP2PKStackSize', function() {
    p2pkStackFixtures.map(function(fixture) {
        it("works for p2pk scripts with the keys", function(cb) {
            var script = fixture[0];
            assert.ok(bitcoin.script.pubKey.output.check(script));
            var decoded = bitcoin.script.pubKey.output.decode(script);

            var estimation = SizeEstimation.estimateP2PKStackSize(decoded);
            assert.equal("object", typeof estimation);
            assert.equal(2, estimation.length);

            var scriptSize = estimation[1];
            assert.equal(script.length, scriptSize);

            var stackSizes = estimation[0];
            assert.equal(1, stackSizes.length);
            assert.equal(SizeEstimation.SIZE_DER_SIGNATURE, stackSizes[0]);
            cb();
        });
    });

    p2pkFormFixtures.map(function(fixture) {
        it("deals with different representations", function(cb) {
            var script = fixture[0];
            var isWit = fixture[1];
            var rs = fixture[2];
            var ws = fixture[3];
            var expectSig = fixture[4];
            var expectWit = fixture[5];

            assert.ok(bitcoin.script.pubKey.output.check(script));
            var decoded = bitcoin.script.pubKey.output.decode(script);
            var stackEst = SizeEstimation.estimateP2PKStackSize(decoded);
            var stackSizes = stackEst[0];

            var est = SizeEstimation.estimateStackSignatureSize(stackSizes, isWit, rs, ws);
            assert.equal("object", typeof est);
            assert.equal(2, est.length);

            var foundSigSize = est[0];
            var foundWitSize = est[1];

            assert.equal(foundSigSize, expectSig);
            assert.equal(foundWitSize, expectWit);
            cb();
        });
    });
});

describe('estimateP2PKHStackSize', function() {
    p2pkhStackFixtures.map(function(fixture) {
        it("works for p2pkh scripts with the keys", function(cb) {
            var script = fixture[0];
            assert.ok(bitcoin.script.pubKeyHash.output.check(script));
            var decoded = bitcoin.script.pubKeyHash.output.decode(script);

            var estimation = SizeEstimation.estimateP2PKHStackSize(decoded);
            assert.equal("object", typeof estimation);
            assert.equal(2, estimation.length);

            var scriptSize = estimation[1];
            assert.equal(scriptSize, script.length);

            var stackSizes = estimation[0];
            assert.equal(2, stackSizes.length);

            assert.equal(stackSizes[0], SizeEstimation.SIZE_DER_SIGNATURE);
            assert.equal(stackSizes[1], 33);
            cb();
        });
    });

    p2pkhFormFixtures.map(function(fixture) {
        it("deals with different representations", function(cb) {
            var script = fixture[0];
            var isWit = fixture[1];
            var rs = fixture[2];
            var ws = fixture[3];
            var expectSig = fixture[4];
            var expectWit = fixture[5];
            var compressed = fixture[6];

            assert.ok(bitcoin.script.pubKeyHash.output.check(script));

            var stackEst = SizeEstimation.estimateP2PKHStackSize(compressed);
            var stackSizes = stackEst[0];

            var est = SizeEstimation.estimateStackSignatureSize(stackSizes, isWit, rs, ws);
            assert.equal("object", typeof est);
            assert.equal(2, est.length);

            var foundSigSize = est[0];
            var foundWitSize = est[1];

            assert.equal(foundSigSize, expectSig);
            assert.equal(foundWitSize, expectWit);
            cb();
        });
    });
});

describe("estimateMultisigStackSize", function() {
    multisigStackFixtures.map(function(fixture) {
        it("works for multisig scripts with the keys", function(cb) {
            var script = fixture[0];
            assert.ok(bitcoin.script.multisig.output.check(script));
            var decoded = bitcoin.script.multisig.output.decode(script);
            var estimation = SizeEstimation.estimateMultisigStackSize(decoded.m, decoded.pubKeys);

            assert.equal("object", typeof estimation);
            assert.equal(2, estimation.length);

            var scriptSize = estimation[1];
            assert.equal(script.length, scriptSize);

            var stackSizes = estimation[0];
            assert.equal(1 + decoded.m, stackSizes.length);
            assert.equal(0, stackSizes[0]);
            for (var i = 0; i < decoded.m; i++) {
                assert.equal(SizeEstimation.SIZE_DER_SIGNATURE, stackSizes[1 + i]);
            }
            cb();
        });
    });

    multisigFormFixtures.map(function(fixture) {
        it("deals with different representations", function(cb) {
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
            cb();
        });
    });

});

describe("SizeEstimation.estimateInputFromScripts", function() {
    it('throws on invalid script type', function(cb) {
        var err;
        try {
            SizeEstimation.estimateInputFromScripts(Buffer.from('', 'hex'), null, null);
        } catch (e) {
            err = e;
        }

        assert.ok(typeof err === "object");
        assert.equal(err.message, "Unsupported script type");
        cb();
    });
});
describe("SizeEstimation.estimateOutputs", function() {
    [0, 1, 5, 9].map(function(size) {
        it("estimates single output, for script size " + size, function(cb) {
            var script = '';
            for (var i = 0; i < size; i++) {
                script = script + '6a';
            }
            var outputsSize = SizeEstimation.calculateOutputsSize([{
                value: 1234,
                script: Buffer.from(script, 'hex')
            }]);
            assert.equal(outputsSize, 8 + 1 + size);
            cb();
        });
    });
});

describe("SizeEstimation.estimateTxWeight", function() {
    var wif = "5KW8Ymmu8gWManGggZZQJeX7U3pn5HtcqqsVrNUbc1SUmVPZbwp";
    var key = bitcoin.ECPair.fromWIF(wif, bitcoin.networks.bitcoin);
    key.compressed = true;

    var hash160 = bitcoin.crypto.hash160(key.getPublicKeyBuffer());
    var p2wpkh = bitcoin.script.witnessPubKeyHash.output.encode(hash160);
    var p2pkh = bitcoin.script.pubKeyHash.output.encode(hash160);

    it("estimates p2wpkh weight", function(cb) {
        var utxos = [
            {
                txid: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
                vout: 0,
                scriptpubkey_hex: p2wpkh
            }
        ];

        var txb = new bitcoin.TransactionBuilder();
        utxos.map(function(utxo) {
            txb.addInput(utxo.txid, utxo.vout, bitcoin.Transaction.DEFAULT_SEQUENCE, p2wpkh);
        });

        txb.addOutput(p2wpkh, 1234);
        txb.sign(0, key, null, null, 0);
        var tx = txb.build();

        var weight = SizeEstimation.estimateTxWeight(tx, utxos);
        var vsize = SizeEstimation.estimateTxVsize(tx, utxos);

        assert.equal(vsize, 110);
        assert.equal(weight, 438);
        assert.equal(vsize, Math.ceil(weight / 4));
        cb();
    });

    it("estimates p2wpkh weight 2", function(cb) {
        var utxos = [
            {
                txid: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
                vout: 0,
                scriptpubkey_hex: p2wpkh
            },
            {
                txid: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd123e",
                vout: 0,
                scriptpubkey_hex: p2wpkh
            },
            {
                txid: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd123f",
                vout: 0,
                scriptpubkey_hex: p2wpkh
            }
        ];

        var txb = new bitcoin.TransactionBuilder();
        utxos.map(function(utxo) {
            txb.addInput(utxo.txid, utxo.vout, bitcoin.Transaction.DEFAULT_SEQUENCE, p2wpkh);
        });

        txb.addOutput(p2wpkh, 1234);
        txb.sign(0, key, null, null, 0);
        txb.sign(1, key, null, null, 0);
        txb.sign(2, key, null, null, 0);
        var tx = txb.build();

        var weight = SizeEstimation.estimateTxWeight(tx, utxos);
        var vsize = SizeEstimation.estimateTxVsize(tx, utxos);

        // NOTE; the REAL weight is 980, we overestimate by 1 byte because the signature is 1 byte shorter for the first 2 inputs
        assert.equal(vsize, 246);
        assert.equal(weight, 982);
        assert.equal(vsize, Math.ceil(weight / 4));
        cb();
    });

    it("weight for non-witness is 4x size", function(cb) {
        var utxos = [
            {
                txid: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
                vout: 0,
                scriptpubkey_hex: p2pkh
            },
            {
                txid: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd123e",
                vout: 0,
                scriptpubkey_hex: p2pkh
            },
            {
                txid: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd123f",
                vout: 0,
                scriptpubkey_hex: p2pkh
            }
        ];

        var txb = new bitcoin.TransactionBuilder();
        utxos.map(function(utxo) {
            txb.addInput(utxo.txid, utxo.vout);
        });

        txb.addOutput(p2wpkh, 1234);
        txb.addOutput(p2wpkh, 1234);
        txb.addOutput(p2wpkh, 1234);
        txb.sign(0, key);
        txb.sign(1, key);
        txb.sign(2, key);
        var tx = txb.build();

        var os = SizeEstimation.calculateOutputsSize(tx.outs);
        var bs = 4 + 1 + SizeEstimation.estimateInputsSize(utxos, false) + 1 + os + 4;

        var weight = SizeEstimation.estimateTxWeight(tx, utxos);
        // NOTE; the REAL weight is 2180, we overestimate by 1 byte because the signature is 1 byte shorter for the first 2 inputs
        assert.equal(weight, 2188);
        assert.equal(weight, bs * 4);

        var vsize = SizeEstimation.estimateTxVsize(tx, utxos);
        assert.equal(Math.ceil(weight / 4), vsize);
        cb();
    });
});

describe("SizeEstimation.estimateInputsSize", function() {
    var wif = "5KW8Ymmu8gWManGggZZQJeX7U3pn5HtcqqsVrNUbc1SUmVPZbwp";
    var key = bitcoin.ECPair.fromWIF(wif, bitcoin.networks.bitcoin);

    var hash160 = bitcoin.crypto.hash160(key.getPublicKeyBuffer());
    var p2wpkh = bitcoin.script.witnessPubKeyHash.output.encode(hash160);

    it("drops witness based on parameter", function(cb) {
        var withWitness = SizeEstimation.estimateInputsSize([{
            value: 1234,
            scriptpubkey_hex: p2wpkh
        }], true);

        var noWitness = SizeEstimation.estimateInputsSize([{
            value: 1234,
            scriptpubkey_hex: p2wpkh
        }], false);

        assert.equal(noWitness, 32 + 4 + 4 + 1);
        /*witness flags + witness vector*/

        var assumeSize = noWitness + 2 + (1 + 1 + SizeEstimation.SIZE_DER_SIGNATURE + 1 + 33);

        assert.ok(assumeSize === withWitness);

        cb();
    });
});

describe("SizeEstimation.estimateUtxo", function() {
    it("throws if P2SH and redeemScript not provided", function(cb) {
        var err;
        try {
            var hash160 = bitcoin.crypto.hash160(Buffer.from("42", "hex"));
            var spk = bitcoin.script.scriptHash.output.encode(hash160);
            SizeEstimation.estimateUtxo({
                scriptpubkey_hex: spk,
                redeem_script: null
            });
        } catch (e) {
            err = e;
        }

        assert.ok(typeof err === "object");
        assert.equal(err.message, "Cant estimate, missing redeem script");
        cb();
    });

    it("throws if P2WSH and witnessScript not provided", function(cb) {
        var err;
        try {
            var hash160 = bitcoin.crypto.sha256(Buffer.from("42", "hex"));
            var spk = bitcoin.script.witnessScriptHash.output.encode(hash160);
            SizeEstimation.estimateUtxo({
                scriptpubkey_hex: spk,
                witness_script: null
            });
        } catch (e) {
            err = e;
        }

        assert.ok(typeof err === "object");
        assert.equal(err.message, "Can't estimate, missing witness script");
        cb();
    });

    it("throws if unsupported script type", function(cb) {
        var err;
        try {
            var spk = Buffer.from('6a', 'hex');
            SizeEstimation.estimateUtxo({
                scriptpubkey_hex: spk,
                witness_script: null
            });
        } catch (e) {
            err = e;
        }

        assert.ok(typeof err === "object");
        assert.equal(err.message, "Unsupported script type");
        cb();
    });

    []
        .concat(multisigUtxoFixtures)
        .concat(p2pkUtxoFixtures)
        .concat(p2pkhUtxoFixtures)
        .map(function(fixture) {
            it("deals with different representations", function(cb) {
                var utxo = fixture[0];
                var expectSig = fixture[1];
                var expectWit = fixture[2];
                var compressed = false;
                if (typeof fixture[3] === "boolean") {
                    compressed = fixture[3];
                }

                var estimate = SizeEstimation.estimateUtxo(utxo, compressed);

                assert.equal(estimate.scriptSig, expectSig);
                assert.equal(estimate.witness, expectWit);
                cb();
            });
        });
});


describe("estimateWitnessPubKeyHash", function() {
    it('should work', function(cb) {
        var utxo = { hash: '4141414141414141414141414141414141414141414141414141414141414141',
            idx: 2,
            scriptpubkey_hex: '00140102030401020304010203040102030401020304',
            value: 1,
            confirmations: 1,
            sign_mode: 'dont_sign',
            address: '2N245vnpchbFYWm5hZ6hqF2zC8QbVpoHeSU',
            path: null,
            redeem_script: null,
            witness_script: null,
            green: null };

        var estimation = SizeEstimation.estimateUtxo(utxo);

        assert.equal(1, estimation.scriptSig);
        assert.equal(108, estimation.witness);

        cb();
    });
});
