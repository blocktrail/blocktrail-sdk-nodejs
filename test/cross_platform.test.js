/* jshint -W101, -W098 */
var assert = require('assert');
var crypto = require('crypto');
var qs = require('querystring');
var superagent = require('superagent'),
    superagentHttpSignature = require('superagent-http-signature/index-hmac-only');

describe("content-MD5", function() {
    it("should be set properly", function(cb) {
        var data = {signature: "HPMOHRgPSMKdXrU6AqQs/i9S7alOakkHsJiqLGmInt05Cxj6b/WhS7kJxbIQxKmDW08YKzoFnbVZIoTI2qofEzk="};

        assert.equal(qs.stringify(data), "signature=HPMOHRgPSMKdXrU6AqQs%2Fi9S7alOakkHsJiqLGmInt05Cxj6b%2FWhS7kJxbIQxKmDW08YKzoFnbVZIoTI2qofEzk%3D");
        assert.equal(crypto.createHash('md5').update(qs.stringify(data)).digest().toString('hex'), "fdfc1a717d2c97649f3b8b2142507129");
        cb();
    });
});

describe("HMAC signature", function() {
    it("should be correct", function(cb) {
        var request = superagent('GET', 'http://example.com/path?query=123');

        request.set('Date', 'today');
        request.set('accept', 'llamas');

        request.use(superagentHttpSignature({
            headers: ['(request-target)', 'date'],
            algorithm: 'hmac-sha256',
            key: 'secret',
            keyId: 'pda'
        }));

        if (request.getHeader) {
            console.log('first');
            var authHeader = request.getHeader('authorization');
        } else {
            console.log('second');
            var authHeader = request.get('authorization');
        }

        //var authHeader = request.getHeader ? request.getHeader('authorization') : request.get('authorization'); // small hack for browserify inconsistency

        assert.ok(authHeader.indexOf('keyId="pda"') >= 0);
        assert.ok(authHeader.indexOf('algorithm="hmac-sha256') >= 0);
        assert.ok(authHeader.indexOf('signature="SFlytCGpsqb/9qYaKCQklGDvwgmrwfIERFnwt+yqPJw="') >= 0);

        request = null;

        cb();
    });
});
