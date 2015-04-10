var blocktrail = require('../');
var crypto = require('crypto');

//the primary mnemonic, obtained from our backup pdf
var primaryMnemonic    = "plug employ detail flee ethics junior cover surround aspect slender venue faith devote ice sword camp pepper baby decrease mushroom feel endless cactus group deposit achieve cheese fire alone size enlist sail labor pulp venture wet gas object fruit dutch industry lend glad category between hidden april network";

//our wallet passphrase
var primaryPassphrase  = "test";

//the primary mnemonic, obtained from our backup pdf
var backupMnemonic     = "disorder husband build smart also alley uncle buffalo scene club reduce fringe assault inquiry damage gravity receive champion coffee awesome conduct two mouse wisdom super lend dice toe emotion video analyst worry charge sleep bless pride motion oxygen congress jewel push bag ozone approve enroll valley picnic flight";

//the blocktrail keys used by this wallet, obtained from the backup pdf
var blocktrailKeys = [
    {
        keyIndex: 0,
        path:     "M/0'",
        pubkey:   'tpubD8UrAbbGkiJUnZY91vYMX2rj7zJRGH7snQ1g9H1waU39U74vE8HAfMCZdBByRJhVHq2B9X6uZcA2VaCJwnPN3zXLAPjETsfPGwAgWgEFvVk'
    },
    {
        keyIndex: 9999,
        path:     "M/9999'",
        pubkey:   'tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ'
    }
];

//we need a bitcoin data service to find utxos. We'll use the BlocktraiBitcoinService, which in turn uses the Blocktrail SDK
var bitcoinDataClient = new blocktrail.BlocktrailBitcoinService({
    apiKey:     "MY_APIKEY",
    apiSecret:  "MY_APISECRET",
    network:    "BTC",
    testnet:    true
});


//create instance of sweeper - will automatically create primary keys from mnemonics
var options = {
    network: 'btc',
    testnet: true,
    logging: true
};
var walletSweeper = new blocktrail.WalletSweeper(primaryMnemonic, primaryPassphrase, backupMnemonic, blocktrailKeys, bitcoinDataClient, options);
console.log('Cool cool cool');

//console.log(walletSweeper.createAddress("M/0'/0/0"));
console.log(walletSweeper.createBatchAddresses(0, 10, 0));

//Do wallet fund discovery - can be run separately from sweeping
//console.log($walletSweeper.discoverWalletFunds());

//Do wallet fund discovery and sweeping - if successful you will be returned a signed transaction ready to submit to the network
//$receivingAddress = "2NCcm7hJfJ5wk6GyKvT2ZHCrNsBgjBv2MSF";
//$result = $walletSweeper.sweepWallet($receivingAddress);
//console.log($result);



/*

//create a new wallet
var walletIdentifier = "nodejs-example-" + crypto.randomBytes(24).toString('hex');
client.createNewWallet(walletIdentifier, "example-strong-password", 9999, function (err, wallet, primaryMnemonic, backupMnemonic, blocktrailPubKeys) {
    if (err) {
        return console.log("createNewWallet ERR", err);
    }

    //generate the backup document
    var backup = new blocktrail.BackupGenerator(primaryMnemonic, backupMnemonic, blocktrailPubKeys);
    //create a pdf
    backup.generatePDF(LIBPATH + "/examples/my-wallet-backup.pdf", function (result) {
        console.log(result);
    });

    //can also be html or an image
    var result = backup.generateHTML();
    fs.writeFile(LIBPATH + "/examples/my-wallet-backup.html", result, function (err) {
         if (err) {
             console.log(err);
         } else {
             console.log("The file was saved!");
         }
     });

    //image (only png)
    backup.generateImage(LIBPATH + "/examples/my-wallet-backup.png", function (result) {
        console.log(result);
    });

});
*/