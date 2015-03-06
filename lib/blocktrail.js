var blocktrail = {
    COIN: 100000000,
    PRECISION: 8,
    DUST: 546,
    BASE_FEE: 10000
};

/**
 * convert a BTC value to Satoshi
 *
 * @param btc   float       BTC value
 * @returns int             Satoshi value (int)
 */
blocktrail.toSatoshi = function(btc) {
    return parseInt((btc * blocktrail.COIN).toFixed(0), 10);
};

/**
 * convert a Satoshi value to BTC
 *
 * @param satoshi   int     Satoshi value
 * @returns {string}        BTC value (float)
 */
blocktrail.toBTC = function(satoshi) {
    return (satoshi / blocktrail.COIN).toFixed(blocktrail.PRECISION);
};

/**
 * patch the Q module to add spreadNodeify method to promises
 *  so that we can support multi parameter callbacks
 *
 * @param Q
 */
blocktrail.patchQ = function(Q) {
    if (Q.spreadNodeify) {
        return;
    }

    Q.spreadNodeify = spreadNodeify;
    function spreadNodeify(object, nodeback) {
        return Q(object).spreadNodeify(nodeback);
    }

    Q.makePromise.prototype.spreadNodeify = function (nodeback) {
        if (nodeback) {
            this.done(function (value) {
                Q.nextTick(function () {
                    nodeback.apply(void 0, [null].concat(value));
                });
            }, function (error) {
                Q.nextTick(function () {
                    nodeback(error);
                });
            });
        } else {
            return this;
        }
    };
};

module.exports = blocktrail;
