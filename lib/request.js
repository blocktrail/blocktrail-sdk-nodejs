var _ = require("lodash"),
    https = require('https'),
    http = require('http'),
    httpSignature = require('http-signature'),
    url = require('url'),
    qs = require('querystring'),
    q = require('q'),
    crypto = require('crypto');

var debug = require('debug')('blocktrail-sdk:request');

var noop = function () {};

/**
 * Helper for doing HTTP requests
 *
 * @param options       object{
 *                          host: '',
 *                          endpoint: '', // base url for .request
 *                          auth: null || 'http-signature',
 *                          apiKey: 'API_KEY',
 *                          apiSecret: 'API_SECRET',
 *                          params: {}, // defaults
 *                          headers: {} // defaults
 *                      }
 * @constructor
 */
function Request(options) {
    var self = this;

    self.https = options.https;
    self.host = options.host;
    self.endpoint = options.endpoint;
    self.auth = options.auth;
    self.apiKey = options.apiKey;
    self.apiSecret = options.apiSecret;

    self.params = _.defaults({}, options.params);
    self.headers = _.defaults({}, options.headers);
}

/**
 * helper to make sure the query string is sorted in lexical order
 *
 * @param params
 * @returns {string}
 */
Request.qs = function(params) {
    var query = [];
    var qsKeys = Object.keys(params);

    qsKeys.sort();
    for (var i in qsKeys) {
        var qsKey = qsKeys[i];
        var qsChunk = {};
        qsChunk[qsKey] = params[qsKey];
        query.push(qs.stringify(qsChunk));
    }

    return query.join("&");
};

/**
 * execute request
 *
 * @param method        string      GET|POST|DELETE
 * @param resource      string      URL
 * @param params        object      are added to the querystring
 * @param data          object      is POSTed
 * @param fn
 * @returns q.Promise
 */
Request.prototype.request = function (method, resource, params, data, fn) {
    var self = this;
    self.deferred = q.defer();

    self.callback = fn || noop;

    var endpoint = url.parse(resource, true);
    var query = Request.qs(_.defaults({}, (params || {}), (endpoint.query || {}), (self.params || {})));

    self.path = ''.concat(self.endpoint, endpoint.pathname);
    if (query) {
        self.path = self.path.concat('?', query);
    }

    if (data) {
        self.payload = JSON.stringify(data);
        self.headers['Content-Type'] = 'application/json';
    }

    self.headers['Content-Length'] = self.payload ? self.payload.length : 0;

    if (method === 'GET' || method === 'DELETE') {
        self.headers['Content-MD5'] = crypto.createHash('md5').update(self.path).digest().toString('hex');
    } else {
        self.headers['Content-MD5'] = crypto.createHash('md5').update(self.payload).digest().toString('hex');
    }

    debug('%s %s %s', method, self.host, self.path);

    var opts = {
        hostname: self.host,
        path: self.path,
        method: method,
        headers: self.headers,
        auth: self.auth,
        agent: false
    };

    self.performRequest(opts);

    return self.deferred.promise;
};

Request.prototype.handleResponse = function (res) {
    var self = this;
    var chunks = '';
    var error;

    res.on('data', function (chunk) {
        chunks += chunk;
    });

    res.on('error', function (err) {
        error = err;
    });

    res.on('end', function () {
        var body;

        debug('response status code: %s content type: %s', res.statusCode, res.headers['content-type']);
        // debug(chunks);

        if (!error && (res.headers['content-type'].indexOf('application/json') >= 0)) {
            try {
                body = JSON.parse(chunks);
            }
            catch (e) {
                // console.log(req, chunks);
                error = e;
            }
        }

        if (!error && res.statusCode !== 200) {
            var msg = body ? body.msg : body || chunks;

            error = new Error(msg);
            error.statusCode = res.statusCode;
        }

        if (error) {
            self.deferred.reject(error);
        } else {
            self.deferred.resolve(body);
        }

        return self.callback(error, body);
    });
};

Request.prototype.performRequest = function (options) {
    var self = this;
    var method = options.method;
    var signHMAC = false;

    if (options.auth === 'http-signature') {
        signHMAC = true;
        delete options.auth;
    }

    var req = (self.https ? https : http).request(options, function (res) {
        return self.handleResponse(res, req);
    });

    if (signHMAC) {
        httpSignature.sign(req, {
            headers: ['(request-target)', 'content-md5', 'date'],
            algorithm: 'hmac-sha256',
            key: self.apiSecret,
            keyId: self.apiKey
        });
    }

    req.on('error', function (e) {
        self.deferred.reject(e);
        return self.callback(e);
    });

    if (self.payload && (method === 'DELETE' || method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        req.write(self.payload);
    }

    req.end();
};

module.exports = Request;
