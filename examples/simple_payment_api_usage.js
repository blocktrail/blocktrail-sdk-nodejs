var blocktrail = require('../'); // require('blocktrail-sdk') when trying example from in your own project

var client = blocktrail.BlocktrailSDK({
    network: 'B2X',
    apiKey : "7907d2cad41586a7bbb5b77c6bb9ce13d25fd376",
    apiSecret : "c003220bf4ebf89958631abe010777ef5e39e938",
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
    client.createNewWallet({
        identifier: "example-wallet1",
        passphrase: "example-strong-password",
        keyIndex: 9999
    }, function(err, wallet, primaryMnemonic, backupMnemonic, blocktrailPubKeys) {
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
    client.initWallet({
        identifier: "example-wallet1",
        readOnly: true
    }, function(err, wallet) {
        if (err) {
            console.log('initWallet ERR', err);
            throw err;
        }

        wallet.getBalance(function(err, confirmed, unconfirmed) {
            if (err) {
                return console.log("getBalance ERR", err);
            }

            console.log('confirmed balance', confirmed);
            console.log('unconfirmed balance', unconfirmed);

            wallet.getNewAddress(function(err, address) {
                if (err) {
                    return console.log("getNewAddress ERR", err);
                }

                console.log('address', address);

                wallet.unlock({passphrase: "example-strong-password"}, function(err) {
                    if (err) {
                        return console.log("unlock ERR", err);
                    }

                    sendTransaction(wallet);
                });
            });
        });
    });
}
