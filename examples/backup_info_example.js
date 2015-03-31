var blocktrail = require('../'); // require('blocktrail-sdk') when trying example from in your own project
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var LIBPATH = path.normalize(__dirname + '/..');

var client = blocktrail.BlocktrailSDK({
    apiKey : "MY_APIKEY",
    apiSecret : "MY_APISECRET",
    testnet : true
});

//create a new wallet
var walletIdentifier = "nodejs-example-" + crypto.randomBytes(24).toString('hex');
client.createNewWallet(walletIdentifier, "example-strong-password", 9999, function (err, wallet, primaryMnemonic, backupMnemonic, blocktrailPubKeys) {
    if (err) {
        return console.log("createNewWallet ERR", err);
    }

    //generate the backup document
    var backup = new blocktrail.BackupGenerator(primaryMnemonic, backupMnemonic, blocktrailPubKeys);
    //create a pdf
    backup.generatePDF(LIBPATH + "/examples/my-wallet-backup.pdf", function (err, result) {
        console.log(err, result);
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
    backup.generateImage(LIBPATH + "/examples/my-wallet-backup.png", function (err, result) {
        console.log(err, result);
    });

});
