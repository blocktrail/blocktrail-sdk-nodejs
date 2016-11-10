module.exports = function (grunt) {

    var browsers = [{
        browserName: 'googlechrome',
        platform: 'Win10'
    }, {
        browserName: 'googlechrome',
        platform: 'linux'
    }, {
        browserName: 'firefox',
        platform: 'Win10'
    }, {
        browserName: 'firefox',
        platform: 'linux'
    }];

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        connect: {
            server: {
                options: {
                    base: '',
                    port: 9999
                }
            }
        },

        'saucelabs-mocha': {
            all: {
                options: {
                    // username: 'saucelabs-user-name', // if not provided it'll default to ENV SAUCE_USERNAME (if applicable)
                    // key: 'saucelabs-key', // if not provided it'll default to ENV SAUCE_ACCESS_KEY (if applicable)
                    urls: [
                        'http://127.0.0.1:9999/test/run-tests.html'
                    ],
                    browsers: browsers,
                    build: process.env.TRAVIS_JOB_ID,
                    testname: 'mocha tests',
                    throttled: 2,
                    statusCheckAttempts: 180,
                    pollInterval: 4000,
                    sauceConfig: {
                        'video-upload-on-pass': true
                    }
                }
            }
        },

        template: {
            runtests: {
                options: {
                    data: {
                        process: {
                            env: process.env
                        }
                    }
                },
                files: {
                    'test/run-tests.html': ['test/run-tests.tpl.html']
                }
            }
        },

        exec: {
            asmcryptobuild: 'cd ./vendor/asmcrypto.js; npm install; grunt --with pbkdf2-hmac-sha512'
        },

        /*
         * Javascript concatenation
         */
        concat : {
            jsPDF: {
                src : [
                    'vendor/jsPDF/jspdf.js',
                    'vendor/jsPDF/jspdf.plugin.split_text_to_size.js',
                    'vendor/jsPDF/jspdf.plugin.addimage.js',
                    'vendor/jsPDF/libs/FileSaver.js/FileSaver.js',
                    'vendor/jsPDF/jspdf.plugin.png_support.js',
                    'vendor/jsPDF/libs/png_support/zlib.js',
                    'vendor/jsPDF/libs/png_support/png.js'
                ],
                dest : 'build/jsPDF.js'
            },
            sdkfull: {
                src : [
                    'build/jsPDF.js',
                    'vendor/asmcrypto.js/asmcrypto.js',
                    'build/blocktrail-sdk.js'
                ],
                dest : 'build/blocktrail-sdk-full.js'
            },
            sdkfullmin: {
                src : [
                    'build/jsPDF.min.js',
                    'vendor/asmcrypto.js/asmcrypto.js',
                    'build/blocktrail-sdk.min.js'
                ],
                dest : 'build/blocktrail-sdk-full.min.js'
            }
        },

        /*
         * Javascript uglifying
         */
        uglify : {
            options: {
                mangle: {
                    except: ['Buffer', 'BitInteger', 'Point', 'Script', 'ECPubKey', 'ECKey']
                }
            },
            dist : {
                files : {
                    'build/jsPDF.min.js'                : ['<%= concat.jsPDF.dest %>'],
                    'build/blocktrail-sdk.min.js'       : ['<%= browserify.sdk.dest %>']
                }
            }
        },

        /*
         *
         */
        browserify: {
            sdk: {
                options : {
                    browserifyOptions : {
                        standalone: 'blocktrailSDK'
                    },
                    transform : ['brfs']
                },
                src: 'main.js',
                dest: 'build/blocktrail-sdk.js'
            },
            test: {
                options : {
                    browserifyOptions : {
                        standalone: 'blocktrailTEST'
                    },
                    transform : ['brfs']
                },
                src: 'test.js',
                dest: 'build/test.js'
            }
        },

        /*
         * Watch
         */
        watch : {
            options : {},
            gruntfile : {
                files : ['Gruntfile.js'],
                tasks : ['default']
            },
            browserify : {
                files : ['main.js', 'test.js', 'test/*', 'test/**/*', 'lib/*', 'lib/**/*'],
                tasks : ['browserify', 'concat', 'template']
            },
            deps : {
                files : ['vendor/**/*.js'],
                tasks : ['concat']
            }
        }
    });

    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-saucelabs');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-notify');
    grunt.loadNpmTasks('grunt-template');
    grunt.loadNpmTasks('grunt-exec');

    grunt.registerTask('build', ['browserify', 'exec:asmcryptobuild', 'concat:jsPDF', 'uglify', 'concat:sdkfull', 'concat:sdkfullmin']);
    grunt.registerTask('test-browser', ['template', 'connect', 'saucelabs-mocha']);
    grunt.registerTask('default', ['build']);
};

