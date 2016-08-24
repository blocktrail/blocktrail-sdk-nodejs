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

        cb();
    });
});
