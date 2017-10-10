var m = require('./../lib/encryption_mnemonic.js');
var stdin = process.openStdin();

stdin.addListener("data", function(EPS) {
    // note: EPS is an object, and when converted to a string it will
    // end with a linefeed.  so we (rather crudely) account for that
    // with toString() and then trim()
    var hex = EPS.toString().trim();
    console.log(hex);
    var buffer = Buffer.from(hex, 'hex');
    var mnemonic = m.encode(buffer);
    var lastTwo = mnemonic.split(" ").slice(-2);
    console.log(buffer);
    console.log(buffer.toString('hex'));
    console.log(mnemonic);
    console.log(lastTwo);
    process.exit(0);
});
