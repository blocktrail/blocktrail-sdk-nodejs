var blocktrail = require('blocktrail-sdk');
var bitcoin = blocktrail.bitcoin;

var client = blocktrail.BlocktrailSDK({
    apiKey : "MY_APIKEY",
    apiSecret : "MY_APISECRET",
    testnet : true
});

client.initWallet({
    identifier: "example-wallet",
    readOnly: true
}, function(err, wallet) {
    if (err) {
        console.log(err);
        return;
    }

    wallet.getNewAddress(function(err, selfAddress) {
        if (err) {
            console.log(err);
            return;
        }

        wallet.unlock({passphrase: "example-strong-password"}, function(err) {
            if (err) {
                console.log(err);
                return;
            }

            // get all UTXOs
            wallet.utxos({limit: 200}, function(err, utxos) {
                // init a bitcoinjs-lib TransactionBuilder
                var txb = new bitcoin.TransactionBuilder();

                // sum up total value of UTXOs
                var total = utxos.data.map(function(utxo) {
                    return utxo['value'];
                }).reduce(function(value, total) {
                    return value + total;
                });

                // add UTXOs as inputs to TransactionBuilder
                utxos.data.forEach(function(utxo) {
                    txb.addInput(utxo['hash'], utxo['idx']);
                });

                // add one output (could be dummy, because we only need it to estimate the fee
                txb.addOutput(selfAddress, total);

                // estimate the fee based on incomplete transaction
                var estimatedFee = blocktrail.Wallet.estimateIncompleteTxFee(txb.buildIncomplete());

                // do a real transaction for the total minus the estimated fee
                var pay = {};
                pay[selfAddress] = total - estimatedFee;

                console.log(total, estimatedFee, pay);

                wallet.pay(pay, function(err, txHash) {
                    if (err) {
                        console.log(err);
                        return;
                    }

                    console.log(txHash);
                });
            });
        });
    });
});
