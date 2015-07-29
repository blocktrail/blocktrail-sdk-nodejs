BlockTrail NodeJS SDK Release Process
=====================================

 - `git submodule update --init --recursive`

 - `grunt build`
 
 - `git commit -m "build for release" build/`

 - `npm version "major|minor|patch|prerelease"`
 
 - `npm publish`
