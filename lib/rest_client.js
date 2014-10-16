var Request = require('./request');

/**
 * Intermediate class to create HTTP requests
 *
 *
 * @param options       object{
 *                          host: '',
 *                          endpoint: '', // base url for .request
 *                          apiKey: 'API_KEY',
 *                          apiSecret: 'API_SECRET'
 *                      }
 * @constructor
 * @constructor
 */
var RestClient = function (options) {
    var self = this;

    self.apiKey = options.apiKey;
    self.apiSecret = options.apiSecret;
    self.https = options.https;
    self.host = options.host;
    self.endpoint = options.endpoint;

    self.defaultParams = {
        'api_key': self.apiKey
    };

    self.defaultHeaders = {
        'User-Agent' : 'rarw'
    }
};

RestClient.prototype.create_request = function(options) {
    var self = this;

    options = extend({}, {
        https: self.https,
        host: self.host,
        endpoint: self.endpoint,
        apiKey: self.apiKey,
        apiSecret: self.apiSecret,
        params: extend({}, self.defaultParams),
        headers: extend({}, self.defaultHeaders)
    }, options);

    return new Request(options);
};

RestClient.prototype.post = function (path, params, data, fn) {
    return this.create_request({auth: 'http-signature'}).request('POST', path, params, data, fn);
};

RestClient.prototype.get = function (path, params, fn) {
    return this.create_request().request('GET', path, params, null, fn);
};

RestClient.prototype.delete = function (path, params, fn) {
    return this.create_request().request('DELETE', path, params, null, fn);
};

function extend(target) {
    var sources = [].slice.call(arguments, 1);
    sources.forEach(function (source) {
        for (var prop in source) {
            target[prop] = source[prop];
        }
    });
    return target;
}

module.exports = function(options) {
    return new RestClient(options);
};
