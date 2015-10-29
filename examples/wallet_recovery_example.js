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

/**
 * backup data from a Wallet V1 Backup PDF (Developer wallets)
 *
 * walletVersion:       the version number of the created wallet
 * primaryMnemonic:     the primary mnemonic, obtained from our backup pdf
 * primaryPassphrase:   our wallet passphrase, as used to unlock the wallet when sending transactions
 * backupMnemonic:      the primary mnemonic, obtained from our backup pdf
 * blocktrailKeys:      an array of the blocktrail pubkeys objects as {keyIndex: keyIndex, path: path, pubkey: pubkey}
 *                          keyIndex:   key index printed below each pubkey QR code on the backup pdf
 *                          path:       path printed below each pubkey QR code on the backup pdf
 *                          pubkey:     the contents of the QR code
 */
var backupDataV1 = {
    walletVersion:      1,
    primaryMnemonic:    "plug employ detail flee ethics junior cover surround aspect slender venue faith devote ice sword camp pepper baby decrease mushroom feel endless cactus group deposit achieve cheese fire alone size enlist sail labor pulp venture wet gas object fruit dutch industry lend glad category between hidden april network",
    primaryPassphrase:  "test",
    backupMnemonic:     "disorder husband build smart also alley uncle buffalo scene club reduce fringe assault inquiry damage gravity receive champion coffee awesome conduct two mouse wisdom super lend dice toe emotion video analyst worry charge sleep bless pride motion oxygen congress jewel push bag ozone approve enroll valley picnic flight",
    blocktrailKeys: [
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
    ]
};


/**
 * backup data from a Wallet V2 Backup PDF (Consumer web and mobile wallets)
 *
 * walletVersion:           the version number of the created wallet
 * encryptedPrimarySeed:    the Encrypted Primary Seed mnemonic, obtained from our backup pdf (page 1)
 * backupSeed:              the backup seed mnemonic, obtained from our backup pdf (page 1)
 *
 * passwordEncryptedSecret: the password encrypted secret, obtained from our backup pdf (page 2)
 * password:                our wallet password, as used to unlock the wallet when sending transactions
 * blocktrailKeys:          an array of the blocktrail pubkeys objects as {keyIndex: keyIndex, path: path, pubkey: pubkey}
 *                              keyIndex:   key index printed below each pubkey QR code on the backup pdf (page 1)
 *                              path:       path printed below each pubkey QR code on the backup pdf (page 1)
 *                              pubkey:     the contents of the QR code (page 1)
 */
var backupDataV2 = {
    walletVersion:              2,
    encryptedPrimarySeed:       "fat arena brown skull echo quiz diesel beach gift olympic riot orphan sketch chief exchange height danger nasty clutch dune wing run drastic roast exist super toddler combine vault salute salad trap spider tenant draw million insane alley pelican spot alpha cheese version clog arm tomorrow slush plunge",
    backupSeed:                 "aerobic breeze taste swear whip service bone siege tackle grow drip few tray clay crumble glass athlete bronze office roast learn tuition exist symptom",

    passwordEncryptedSecret:    "fat arena brown skull echo quick damage toe later above jewel life void despair outer model annual various original stool answer vessel tired fragile visa summer step dash inform unit member social liberty valve tonight ocean pretty dial ability special angry like ancient unit shiver safe hospital ocean around poet album split they random decide ginger guilt mix evolve click avoid oven sad gospel worry chaos another lonely essence lucky health view",
    password:                   "test",

    blocktrailKeys: [
        {
            keyIndex: 0,
            path:     "M/0'",
            pubkey:   'xpub687DeMmb3SM2WUySJREg6F2vvRCQE1uSHcm5DY6HKyJe5oCczqavKHWUS8e5hDdx5bU4EWzFq9vSRSbi2rEYShdw6ectgbxAqmBgg8ZaqtC'
        }
    ]
};

//we need a bitcoin data service to find utxos. We'll use the BlocktraiBitcoinService, which in turn uses the Blocktrail SDK
var bitcoinDataClient = new blocktrail.BlocktrailBitcoinService({
    apiKey:     "MY_APIKEY",
    apiSecret:  "MY_APISECRET",
    network:    "BTC",
    testnet:    false
});
//there is also a Insight data service using bitpay's API
//bitcoinDataClient = new blocktrail.InsightBitcoinService({testnet: true});




//create instance of sweeper - will automatically create primary keys from mnemonics
var sweeperOptions = {
    network: 'btc',
    testnet: true,
    logging: true,
    sweepBatchSize: 20
};
var walletSweeper = new blocktrail.WalletSweeper(backupDataV1, bitcoinDataClient, sweeperOptions);  //version 1, testnet
bitcoinDataClient.testnet = false;
sweeperOptions.testnet = false;
walletSweeper = new blocktrail.WalletSweeper(backupDataV2, bitcoinDataClient, sweeperOptions);      //version 2, mainnet



//Do wallet fund discovery - can be run separately from sweeping
console.log('-----Discovering Funds-----');
var batchSize = 20;
walletSweeper.discoverWalletFunds(batchSize).done(function(result) {
    console.log(result);
}, function(err) {
    console.log(err);
});

return false;



//Do wallet fund discovery and sweeping - if successful you will be returned a signed transaction ready to submit to the network
console.log('\n-----Sweeping Wallet-----');
var receivingAddress = "2NCfSZa6f8YwAnjvGcorGDdMSyY9kMzQTZe";
walletSweeper.sweepWallet(receivingAddress).done(function(result) {
    console.log(result);
}, function(err) {
    console.log(err);
});
