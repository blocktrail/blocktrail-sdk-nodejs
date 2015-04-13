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
var sweeperOptions = {
    network: 'btc',
    testnet: true,
    logging: true,
    sweepBatchSize: 10
};
var walletSweeper = new blocktrail.WalletSweeper(primaryMnemonic, primaryPassphrase, backupMnemonic, blocktrailKeys, bitcoinDataClient, sweeperOptions);



//Do wallet fund discovery - can be run separately from sweeping
console.log('-----Discovering Funds-----');
var batchSize = 10;
walletSweeper.discoverWalletFunds(batchSize).done(function(result) {
    console.log(result);
}, function(err) {
    console.log(err);
});



//Do wallet fund discovery and sweeping - if successful you will be returned a signed transaction ready to submit to the network
console.log('\n-----Sweeping Wallet-----');
var receivingAddress = "2NCfSZa6f8YwAnjvGcorGDdMSyY9kMzQTZe";
walletSweeper.sweepWallet(receivingAddress).done(function(result) {
    console.log(result);
}, function(err) {
    console.log(err);
});