BlockTrail NodeJS SDK Release Process
=====================================

 - `git submodule update --init --recursive`

 - `grunt build`
 
 - `git commit -m "build for release" build/`

 - `npm version prerelease` # gotta change this to `major` or `minor` or `patch`
 
 - `npm publish`
