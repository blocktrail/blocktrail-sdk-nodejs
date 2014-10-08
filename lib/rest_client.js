var Request = require('./request');

var RestClient = function (options) {
    var self = this;

    self.apiKey = options.apiKey;
    self.apiSecret = options.apiSecret;
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
        host: self.host,
        endpoint: self.endpoint,
        apiKey: self.apiKey,
        apiSecret: self.apiSecret,
        params: self.defaultParams,
        headers: self.defaultHeaders
    }, (options || {}));

    return new Request(options);
};

RestClient.prototype.post = function (path, params, data, fn) {
    return this.create_request({'auth': 'http-signature'}).request('POST', path, params, data, fn);
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
