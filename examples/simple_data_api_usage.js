var BlockTrail = require('blocktrail-sdk');

var client = BlockTrail({
    apiKey : "MYKEY",
    apiSecret : "MYSECRET",
    network : "BTC",
    testnet : false,
    apiVersion : 'v1'
});

client.address("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", function(err, address) {
    console.log('address', err || address['address']);
});

client.address_transactions("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", {limit: 23}, function(err, address_txs) {
    console.log('address_transactions', err || address_txs['data'].length);
});

client.verify_address("16dwJmR4mX5RguGrocMfN9Q9FR2kZcLw2z", "HPMOHRgPSMKdXrU6AqQs/i9S7alOakkHsJiqLGmInt05Cxj6b/WhS7kJxbIQxKmDW08YKzoFnbVZIoTI2qofEzk=", function(err, result) {
    console.log('verify_address', err || result);
});
