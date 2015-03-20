BlockTrail NodeJS SDK
=====================
This is the BlockTrail NodeJS SDK. This SDK contains methods for easily interacting with the BlockTrail API.
Below are examples to get you started. For additional examples, please see our official documentation
at https://www.blocktrail.com/api/docs/lang/nodejs

[![Latest Stable Version](https://badge.fury.io/js/blocktrail-sdk.svg)](https://www.npmjs.org/package/blocktrail-sdk)
[![Build Status](https://travis-ci.org/blocktrail/blocktrail-sdk-nodejs.png?branch=master)](https://travis-ci.org/blocktrail/blocktrail-sdk-nodejs)

IMPORTANT! FLOATS ARE EVIL!!
----------------------------
As is best practice with financial data, The API returns all values as an integer, the Bitcoin value in Satoshi's.
**In Javascript even more than in other languages it's really easy to make mistakes whem converting from float to integer etc!**

The BlockTrail SDK has some easy to use functions to do this for you, we recommend using these
and we also **strongly** recommend doing all Bitcoin calculation and storing of data in integers
and only convert to/from Bitcoin float values for displaying it to the user.

```javascript
var blocktrail = require('blocktrail-sdk');

console.log("123456789 Satoshi to BTC: ", blocktrail.toBTC(123456789));
console.log("1.23456789 BTC to Satoshi: ", blocktrail.toSatoshi(1.23456789));
```

A bit more about this can be found [in our documentation](https://www.blocktrail.com/api/docs/lang/nodejs#api_coin_format).

Installation
------------
You can install the package through NPM (https://www.npmjs.org/package/blocktrail-sdk).
```
$ npm install blocktrail-sdk
```

Dependancies
------------
The following dependancies are required:
 - crypto
 - http-signatures
 - q

Usage
-----
Please visit our official documentation at https://www.blocktrail.com/api/docs/lang/nodejs for the usage.

Support and Feedback
--------------------
Be sure to visit the BlockTrail API official [documentation website](https://www.blocktrail.com/api/docs/lang/nodejs)
for additional information about our API.

If you find a bug, please submit the issue in Github directly.
[BlockTrail-NodeJS-SDK Issues](https://github.com/blocktrail/blocktrail-sdk-nodejs/issues)

As always, if you need additional assistance, drop us a note at
[support@blocktrail.com](mailto:support@blocktrail.com).

Unit Tests
----------
Unit Tests are created with Mocha and can be ran with `npm test` (or `mocha`)

Browserify
----------
```
browserify -o bundle.js -s blocktrail main.js
```

Node Modules Symlink
--------------------
To make all the examples use `require('blocktrail-sdk')` just like when the module would have been installed with NPM 
we symlinked `node_modules/blocktrail-sdk` to the root of this directory.

License
-------
The BlockTrail NodeJS SDK is released under the terms of the MIT license. See LICENCE.md for more information or see http://opensource.org/licenses/MIT.

