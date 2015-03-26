var fs = require('fs');
var exec = require("child_process").exec;

var exclude = ['browserify'];

exec("browserify " + __dirname + "/../main.js --list", function(err, stdout, stderr) {
    var files = stdout.split("\n");

    var moduleSizes = {};

    files.filter(function(f) { return !!f; }).forEach(function(file) {
        var modules = file.match(/node_modules\/(.+?)\//g);

        if (modules) {
            var module = null;
            modules.forEach(function(_module, i) {
                if (module) {
                    return;
                }

                _module = _module.substr(13, _module.length - 14);

                if (exclude.indexOf(_module) === -1 || i === modules.length - 1) {
                    module = _module;
                }
            });
        } else {
            module = "self";
        }

        moduleSizes[module] = (moduleSizes[module] || 0) + fs.statSync(file)['size'];
    });

    console.log(moduleSizes);
});
