BlockTrail NodeJS SDK Changelog
===============================

v1.4.0
------
 - New [Default] Wallet Version 2
 - `BackupGenerator` now supports `extra` to be printed on document for extra notes
 - No longer support `BackupGenerator::generateImage`

### Upgrade / BC breaks
 - `createNewWallet` now returns `spread(wallet, backupInfo)` to be able to support both v1 and v2
 - `new BackupGenerator()` now takes `identifier, backupInfo, extra`
 - No longer support `BackupGenerator::generateImage`

### New [Default] Wallet Version 2
Instead of using `BIP39`, wallet seeds will now be stored encrypted - to allow for password changes

Wallet Creation:  
```
primarySeed = random()
secret = random()
primaryMnemonic = BIP39.entropyToMnemonic(AES.encrypt(primarySeed, secret))
secretMnemonic = BIP39.entropyToMnemonic(AES.encrypt(secret, password))
```

Wallet Init:  
```
secret = BIP39.entropyToMnemonic(AES.decrypt(secretMnemonic, password))
primarySeed = BIP39.entropyToMnemonic(AES.decrypt(primaryMnemonic, secret))
```

See `docs/KEYS.md` for more info
   
Old Wallets that are v1 will remain so and will continue working.

v1.3.12
-------
 - add batch support for fetching multiple transactions.
 - use .notify on the pay promise for progress.
 - allow for bypassing of local derivation of new address (used to verify API response)
