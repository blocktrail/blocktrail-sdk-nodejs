module.exports = function (grunt) {
    grunt.initConfig({

        /*
         * Javascript concatenation
         */
        concat : {
            jsPDF: {
                src : [
                    'vendor/jsPDF/jspdf.js',
                    'vendor/jsPDF/jspdf.plugin.split_text_to_size.js',
                    'vendor/jsPDF/jspdf.plugin.addimage.js',
                    'vendor/jsPDF/jspdf.plugin.png_support.js',
                    'vendor/jsPDF/libs/png_support/zlib.js',
                    'vendor/jsPDF/libs/png_support/png.js'
                ],
                dest : 'build/jsPDF.js'
            },
            qrcode: {
                src : [
                'node_modules/qrcode/build/qrcode.js',
                'node_modules/qrcode/vendors/excanvas/excanvas.js'
                ],
                dest : 'build/qrcode.js'
            },
            deps: {
                src : [
                    '<%= concat.jsPDF.dest %>',
                    '<%= concat.qrcode.dest %>'
                ],
                dest : 'build/blocktrail-sdk-deps.js'
            },
            sdkfull: {
                src : [
                    '<%= concat.deps.dest %>',
                    '<%= browserify.sdk.dest %>'
                ],
                dest : 'build/blocktrail-sdk-full.js'
            }
        },

        /*
         * Javascript uglifying
         */
        uglify : {
            options: {
                mangle: false
            },
            dist : {
                files : {
                    'build/jsPDF.min.js'                : ['<%= concat.jsPDF.dest %>'],
                    'build/blocktrail-sdk.min.js'       : ['<%= browserify.sdk.dest %>'],
                    'build/blocktrail-sdk-deps.min.js'  : ['<%= concat.deps.dest %>'],
                    'build/blocktrail-sdk-full.min.js'  : ['<%= concat.sdkfull.dest %>']
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
                files : ['main.js', 'lib/*', 'lib/**/*'],
                tasks : ['browserify', 'uglify']
            },
            deps : {
                files : ['vendor/**/*.js'],
                tasks : ['concat']
            }
        }
    });

    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-notify');

    grunt.registerTask('default', ['browserify', 'concat', 'uglify']);
};

