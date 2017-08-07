var assert = require('assert');

describe('buffer', function() {
    it("should reverse", function() {
        var b = new Buffer('010203', 'hex');
        assert.equal(b.reverse().toString('hex'), '030201');
    });
});
