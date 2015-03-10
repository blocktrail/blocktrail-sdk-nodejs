/* jshint -W100, -W071 */
var _ = require("lodash"),
    url = require('url'),
    qs = require('querystring'),
    q = require('q'),
    crypto = require('crypto'),
    superagent = require('superagent');

if (!superagent.Request.prototype.get) {
    superagent.Request.prototype.get = superagent.Request.prototype.getHeader;
}

superagent.Request.prototype.sign = function (options) {
    // Copyright 2012 Joyent, Inc.  All rights reserved.
    var sprintf = require('util').format;

    ///--- Globals
    var Algorithms = {
        'rsa-sha1': true,
        'rsa-sha256': true,
        'rsa-sha512': true,
        'dsa-sha1': true,
        'hmac-sha1': true,
        'hmac-sha256': true,
        'hmac-sha512': true
    };

    var Authorization = 'Signature keyId="%s",algorithm="%s",headers="%s",signature="%s"';

    ///--- Specific Errors
    function MissingHeaderError(message) {
        this.name = 'MissingHeaderError';
        this.message = message;
        this.stack = (new Error()).stack;
    }

    MissingHeaderError.prototype = new Error();


    function InvalidAlgorithmError(message) {
        this.name = 'InvalidAlgorithmError';
        this.message = message;
        this.stack = (new Error()).stack;
    }

    InvalidAlgorithmError.prototype = new Error();

    function pathFromURL(path) {
        var match = path.match(/^(?:(.*?):\/\/?)?\/?(?:[^\/\.]+\.)*?([^\/\.]+)\.?([^\/]*)(?:([^?]*)?(?:\?(‌​[^#]*))?)?(.*)?/);

        if (!match) {
            return false;
        }

        return match[4] + (match[6] || "");
    }


    ///--- Internal Functions
    function _pad(val) {
        if (parseInt(val, 10) < 10) {
            val = '0' + val;
        }
        return val;
    }

    function _rfc1123() {
        var date = new Date();

        var months = ['Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec'];
        var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getUTCDay()] + ', ' +
            _pad(date.getUTCDate()) + ' ' +
            months[date.getUTCMonth()] + ' ' +
            date.getUTCFullYear() + ' ' +
            _pad(date.getUTCHours()) + ':' +
            _pad(date.getUTCMinutes()) + ':' +
            _pad(date.getUTCSeconds()) +
            ' GMT';
    }

    if (!options.headers) {
        options.headers = ['date'];
    }
    if (!this.get('Date') && options.headers.indexOf('date') !== -1) {
        this.set('Date', _rfc1123());
    }
    if (!options.algorithm) {
        options.algorithm = 'rsa-sha256';
    }
    if (!options.httpVersion) {
        options.httpVersion = '1.1';
    }

    options.algorithm = options.algorithm.toLowerCase();

    if (!Algorithms[options.algorithm]) {
        throw new InvalidAlgorithmError(options.algorithm + ' is not supported');
    }

    var i;
    var stringToSign = '';
    var value;
    for (i = 0; i < options.headers.length; i++) {
        if (typeof (options.headers[i]) !== 'string') {
            throw new TypeError('options.headers must be an array of Strings');
        }

        var h = options.headers[i].toLowerCase();

        if (h === 'request-line') {
            value =
                stringToSign +=
                    this.method + ' ' + pathFromURL(this.url) + ' HTTP/' + options.httpVersion;
        } else if (h === '(request-target)') {
            value =
                stringToSign +=
                    '(request-target): ' + this.method.toLowerCase() + ' ' + pathFromURL(this.url);
        } else {
            value = this.get(h);
            if (!value) {
                throw new MissingHeaderError(h + ' was not in the request');
            }
            stringToSign += h + ': ' + value;
        }

        if ((i + 1) < options.headers.length) {
            stringToSign += '\n';
        }
    }

    var alg = options.algorithm.match(/(hmac|rsa)-(\w+)/);
    var signature;
    if (alg[1] === 'hmac') {
        var hmac = crypto.createHmac(alg[2].toUpperCase(), options.key);
        hmac.update(stringToSign);
        signature = hmac.digest('base64');
    } else {
        var signer = crypto.createSign(options.algorithm.toUpperCase());
        signer.update(stringToSign);
        signature = signer.sign(options.key, 'base64');
    }

    this.set('Authorization', sprintf(Authorization,
        options.keyId,
        options.algorithm,
        options.headers.join(' '),
        signature));

    return true;
};

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
    self.port = options.port;
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
Request.qs = function (params) {
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
        port: self.port,
        method: method,
        headers: self.headers,
        auth: self.auth,
        agent: false,
        withCredentials: false
    };

    self.performRequest(opts);

    return self.deferred.promise;
};

Request.prototype.performRequest = function (options) {
    var self = this;
    var method = options.method;
    var signHMAC = false;

    if (options.auth === 'http-signature') {
        signHMAC = true;
        delete options.auth;
    }

    var uri = (self.https ? 'https://' : 'http://') + options.hostname + options.path;

    var request = superagent(method, uri);

    if (self.payload && (method === 'DELETE' || method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        request.send(self.payload);
    }

    _.forEach(options.headers, function (value, header) {
        request.set(header, value);
    });

    if (signHMAC) {
        //req.method = method;
        //req.path = options.path;
        request.sign({
            headers: ['(request-target)', 'content-md5'],
            algorithm: 'hmac-sha256',
            key: self.apiSecret,
            keyId: self.apiKey
        });
    }

    request.end(function (error, res) {
        var body;

        if (error) {
            self.deferred.reject(error);
            return self.callback(error);
        }

        debug('response status code: %s content type: %s', res.status, res.headers['content-type']);

        if (!error && (res.headers['content-type'].indexOf('application/json') >= 0)) {
            try {
                body = JSON.parse(res.text);
            } catch (e) {
                error = e;
            }
        }

        if (!error && res.status !== 200) {
            var msg = body ? body.msg : body || res.text;

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

    return self.deferred;
};

module.exports = Request;
