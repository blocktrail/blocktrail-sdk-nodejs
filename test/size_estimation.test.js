/* jshint -W101, -W098 */
/* global window */
var _ = require('lodash');
var assert = require('assert');
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
