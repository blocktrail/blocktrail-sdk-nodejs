var blocktrail = require('blocktrail-sdk');
var bitcoin = blocktrail.bitcoin;

var client = blocktrail.BlocktrailSDK({
    apiKey : "MY_APIKEY",
    apiSecret : "MY_APISECRET",
    testnet : true
});

console.log(blocktrail.Wallet.estimateFee(193, 1));

client.initWallet({
    identifier: "example-wallet",
    readOnly: true
}, function(err, wallet) {
    wallet.getNewAddress(function(err, selfAddress) {
        wallet.unlock({passphrase: "example-strong-password"}, function(err) {
            wallet.getInfo(function(err, walletInfo) {
                var estFee = blocktrail.Wallet.estimateFee(walletInfo.confirmed_utxos + walletInfo.unconfirmed_utxos, 1);

                var pay = {};
                pay[selfAddress] = walletInfo.confirmed + walletInfo.unconfirmed - estFee;

                wallet.pay(pay, function(err, txHash) {
                    console.log(err, txHash);
                });
            });
        });
    });
});
