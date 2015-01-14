var blocktrail = require('blocktrail-sdk');

var client = blocktrail({
    apiKey : "MY_APIKEY",
    apiSecret : "MY_APISECRET",
    testnet : true
});

var sendTransaction = function(wallet) {
    wallet.getNewAddress(function(err, address, path) {
        if (err) {
            return console.log("getNewAddress ERR", err);
        }

        console.log('new address', address, path);

        var pay = {};
        pay[address] = blocktrail.toSatoshi(0.001);

        wallet.pay(pay, function(err, result) {
            if (err) {
                return console.log("pay ERR", err);
            }

            console.log('transaction', result);
        });
    });
};

var action = 'default';

if (action === 'create') {
    client.createNewWallet("example-wallet", "example-strong-password", 9999, function(err, wallet, primaryMnemonic, backupMnemonic, blocktrailPubKeys) {
        if (err) {
            return console.log("createNewWallet ERR", err);
        }

        console.log('primary mnemonic', primaryMnemonic);
        console.log('backup mnemonic', backupMnemonic);
        console.log('blocktrail pubkeys', blocktrailPubKeys);

        wallet.doDiscovery(function(err, confirmed, unconfirmed) {
            if (err) {
                return console.log("doDiscovery ERR", err);
            }

            console.log('confirmed balance', confirmed);
            console.log('unconfirmed balance', unconfirmed);

            sendTransaction(wallet);
        });
    });
} else {
    client.initWallet("example-wallet", "example-strong-password", function(err, wallet) {
        if (err) {
            return console.log('initWallet ERR', err);
        }

        wallet.getBalance(function(err, confirmed, unconfirmed) {
            if (err) {
                return console.log("getBalance ERR", err);
            }

            console.log('confirmed balance', confirmed);
            console.log('unconfirmed balance', unconfirmed);

            sendTransaction(wallet);
        });
    });
}
