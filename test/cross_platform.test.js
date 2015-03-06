/* jshint -W101, -W098 */
var assert = require('assert');
var crypto = require('crypto');
var qs = require('querystring');
var http = require('http'),
    httpSignature = require('http-signature');

module.exports = {
    'test content MD5': function (cb) {

        var data = {signature: "HPMOHRgPSMKdXrU6AqQs/i9S7alOakkHsJiqLGmInt05Cxj6b/WhS7kJxbIQxKmDW08YKzoFnbVZIoTI2qofEzk="};

        assert.equal(qs.stringify(data), "signature=HPMOHRgPSMKdXrU6AqQs%2Fi9S7alOakkHsJiqLGmInt05Cxj6b%2FWhS7kJxbIQxKmDW08YKzoFnbVZIoTI2qofEzk%3D");
        assert.equal(crypto.createHash('md5').update(qs.stringify(data)).digest().toString('hex'), "fdfc1a717d2c97649f3b8b2142507129");
        cb();
    },
    'test HMAC': function (cb) {
        var req = http.request({
            host: 'example.com',
            method: 'GET',
            path: '/path?query=123',
            headers: {
                'Date': 'today',
                'accept': 'llamas'
            }
        });

        httpSignature.sign(req, {
            headers: ['(request-target)', 'date'],
            algorithm: 'hmac-sha256',
            key: 'secret',
            keyId: 'pda'
        });

        var authHeader = req.getHeader('authorization');

        assert.ok(authHeader.indexOf('keyId="pda"') >= 0);
        assert.ok(authHeader.indexOf('algorithm="hmac-sha256') >= 0);
        assert.ok(authHeader.indexOf('signature="SFlytCGpsqb/9qYaKCQklGDvwgmrwfIERFnwt+yqPJw="') >= 0);

        // close req
        req.end();

        cb();
    }
};
