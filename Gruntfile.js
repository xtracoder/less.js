'use strict';

module.exports = function (grunt) {

    // Report the elapsed execution time of tasks.
    require('time-grunt')(grunt);

    var COMPRESS_FOR_TESTS = true;

   // Sauce Labs browser
    var browsers = [
        // Desktop browsers
        {
            browserName: "chrome",
            version: 'latest',
            platform: 'Windows 7'
        },
        {
            browserName: "firefox",
            version: 'latest',
            platform: 'Linux'
        },
        {
            browserName: 'safari',
            version: '9',
            platform: 'OS X 10.11'
        },
        {
            browserName: 'safari',
            version: '8',
            platform: 'OS X 10.10'
        },
        {
            browserName: "internet explorer",
            version: '8',
            platform: 'Windows XP'
        },
        {
            browserName: "internet explorer",
            version: '9',
            platform: 'Windows 7'
        },
        {
            browserName: "internet explorer",
            version: '11',
            platform: 'Windows 8.1'
        },
        {
            browserName: "edge",
            version: '13',
            platform: 'Windows 10'
        },
        // Mobile browsers
        {
            browserName: "ipad",
            version: '8.0',
            platform: 'OS X 10.9',
            'device-orientation': 'portrait'
        },
        {
            browserName: 'iphone',
            version: '7.1',
            platform: 'OS X 10.9'
        },
        {
            browserName: 'iphone',
            version: '9.3',
            platform: 'OS X 10.10'
        },
        {
            browerName: 'android',
            version: '4.2',
            platform: 'Linux'
        }
    ];
       
    var sauceJobs = {};

    var browserTests = [   "filemanager-plugin",
                            "visitor-plugin",
                            "global-vars", 
                            "modify-vars", 
                            "production", 
                            "rootpath-relative",
                            "rootpath", 
                            "relative-urls", 
                            "browser", 
                            "no-js-errors", 
                            "legacy"
                        ];

    browserTests.map(function(testName) {
        sauceJobs[testName] = {
            options: {
                urls: ["http://localhost:8081/tmp/browser/test-runner-" + testName + ".html"],
                testname: 'Less.js test - ' + testName,
                browsers: browsers,
                public: 'public',
                recordVideo: false,
                videoUploadOnPass: false,
                recordScreenshots: process.env.TRAVIS_BRANCH !== "master",
                build: process.env.TRAVIS_BRANCH === "master" ? process.env.TRAVIS_JOB_ID : undefined,
                tags: [process.env.TRAVIS_BUILD_NUMBER, process.env.TRAVIS_PULL_REQUEST, process.env.TRAVIS_BRANCH],
                sauceConfig: {
                    'idle-timeout': 100
                },
                throttled: 5,
                onTestComplete: function(result, callback) {
                    // Called after a unit test is done, per page, per browser
                    // 'result' param is the object returned by the test framework's reporter
                    // 'callback' is a Node.js style callback function. You must invoke it after you
                    // finish your work.
                    // Pass a non-null value as the callback's first parameter if you want to throw an
                    // exception. If your function is synchronous you can also throw exceptions
                    // directly.
                    // Passing true or false as the callback's second parameter passes or fails the
                    // test. Passing undefined does not alter the test result. Please note that this
                    // only affects the grunt task's result. You have to explicitly update the Sauce
                    // Labs job's status via its REST API, if you want so.
            
                    // This should be the encrypted value in Travis
                    var user = process.env.SAUCE_USERNAME;
                    var pass = process.env.SAUCE_ACCESS_KEY;

                    require('request').put({
                        url: ['https://saucelabs.com/rest/v1', user, 'jobs', result.job_id].join('/'),
                        auth: { user: user, pass: pass },
                        json: { passed: result.passed }
                    }, function (error, response, body) {
                      if (error) {
                        console.log(error);
                        callback(error);
                      } else if (response.statusCode !== 200) {
                        console.log(response);
                        callback(new Error('Unexpected response status'));
                      } else {
                        callback(null, result.passed);
                      }
                    });
                }
            }
        };
    });
    // Project configuration.
    grunt.initConfig({

        // Metadata required for build.
        build: grunt.file.readYAML('build/build.yml'),
        pkg: grunt.file.readJSON('package.json'),
        meta: {
            copyright: 'Copyright (c) 2009-<%= grunt.template.today("yyyy") %>',
            banner: '/*!\n' +
                ' * Less - <%= pkg.description %> v<%= pkg.version %>\n' +
                ' * http://lesscss.org\n' +
                ' *\n' +
                ' * <%= meta.copyright %>, <%= pkg.author.name %> <<%= pkg.author.email %>>\n' +
                ' * Licensed under the <%= pkg.license %> License.\n' +
                ' *\n' +
                ' */\n\n' +
                ' /**' +
                ' * @license <%= pkg.license %>\n' +
                ' */\n\n'
        },

        shell: {
            options: {stdout: true, failOnError: true},
            test: {
                command: 'node test/index.js'
            },
            benchmark: {
                command: 'node benchmark/index.js'
            },
            "sourcemap-test": {
                command: [
                    'node bin/lessc --source-map=test/sourcemaps/maps/import-map.map test/less/import.less test/sourcemaps/import.css',
                    'node bin/lessc --source-map test/less/sourcemaps/basic.less test/sourcemaps/basic.css'
                ].join('&&')
            }
        },

        browserify: {
            browser: {
                src: ['./lib/less-browser/bootstrap.js'],
                options: {
                    exclude: ["promise"],
                    browserifyOptions: {
                        standalone: 'less'
                    }
                },
                dest: 'tmp/less.js'
            },
            rhino: {
                src: ['./lib/less-rhino/index.js'],
                dest: 'dist/rhino/less-rhino.js'
            }
        },
        concat: {
            options: {
                stripBanners: 'all',
                banner: '<%= meta.banner %>'
            },
            browsertest: {
                src: COMPRESS_FOR_TESTS ? '<%= uglify.test.dest %>' : '<%= browserify.browser.dest %>',
                dest: 'test/browser/less.js'
            },
            dist: {
                src: '<%= browserify.browser.dest %>',
                dest: 'dist/less.js'
            },
            // Rhino
            rhino: {
                options: {
                    banner: '/* Less.js v<%= pkg.version %> RHINO | <%= meta.copyright %>, <%= pkg.author.name %> <<%= pkg.author.email %>> */\n\n',
                    footer: '' // override task-level footer
                },
                src: ['<%= build.rhino %>'],
                dest: 'dist/less-rhino.js'
            },
            // lessc for Rhino
            rhinolessc: {
                options: {
                    banner: '/* Less.js v<%= pkg.version %> RHINO | <%= meta.copyright %>, <%= pkg.author.name %> <<%= pkg.author.email %>> */\n\n',
                    footer: '' // override task-level footer
                },
                src: ['<%= build.rhinolessc %>'],
                dest: 'dist/lessc-rhino.js'
            }
        },

        uglify: {
            options: {
                banner: '<%= meta.banner %>',
                mangle: true,
                compress: {
                    pure_getters: true
                }
            },
            dist: {
                src: ['<%= concat.dist.dest %>'],
                dest: 'dist/less.min.js'
            },
            test: {
                src: '<%= browserify.browser.dest %>',
                dest: 'tmp/less.min.js'
            }
        },

        jshint: {
            options: {jshintrc: '.jshintrc'},
            files: {
                src: [
                    'Gruntfile.js',
                    'lib/less/**/*.js',
                    'lib/less-node/**/*.js',
                    'lib/less-browser/**/*.js',
                    'lib/less-rhino/**/*.js',
                    'bin/lessc'
                ]
            }
        },

        jscs: {
            src: ["test/**/*.js", "lib/less*/**/*.js", "bin/lessc"],
            options: {
                config: ".jscsrc"
            }
        },

        connect: {
            server: {
                options: {
                    port: 8081
                }
            }
        },

        jasmine: {
            options: {
                keepRunner: true,
                host: 'http://localhost:8081/',
                vendor: ['test/browser/jasmine-jsreporter.js', 'test/browser/common.js', 'test/browser/less.js'],
                template: 'test/browser/test-runner-template.tmpl'
            },
            main: {
                // src is used to build list of less files to compile
                src: ['test/less/*.less', '!test/less/javascript.less', '!test/less/urls.less', '!test/less/empty.less'],
                options: {
                    helpers: 'test/browser/runner-main-options.js',
                    specs: 'test/browser/runner-main-spec.js',
                    outfile: 'tmp/browser/test-runner-main.html'
                }
            },
            legacy: {
                src: ['test/less/legacy/*.less'],
                options: {
                    helpers: 'test/browser/runner-legacy-options.js',
                    specs: 'test/browser/runner-legacy-spec.js',
                    outfile: 'tmp/browser/test-runner-legacy.html'
                }
            },
            strictUnits: {
                src: ['test/less/strict-units/*.less'],
                options: {
                    helpers: 'test/browser/runner-strict-units-options.js',
                    specs: 'test/browser/runner-strict-units-spec.js',
                    outfile: 'tmp/browser/test-runner-strict-units.html'
                }
            },
            errors: {
                src: ['test/less/errors/*.less', '!test/less/errors/javascript-error.less', 'test/browser/less/errors/*.less'],
                options: {
                    timeout: 20000,
                    helpers: 'test/browser/runner-errors-options.js',
                    specs: 'test/browser/runner-errors-spec.js',
                    outfile: 'tmp/browser/test-runner-errors.html'
                }
            },
            noJsErrors: {
                src: ['test/less/no-js-errors/*.less'],
                options: {
                    helpers: 'test/browser/runner-no-js-errors-options.js',
                    specs: 'test/browser/runner-no-js-errors-spec.js',
                    outfile: 'tmp/browser/test-runner-no-js-errors.html'
                }
            },
            browser: {
                src: ['test/browser/less/*.less'],
                options: {
                    helpers: 'test/browser/runner-browser-options.js',
                    specs: 'test/browser/runner-browser-spec.js',
                    outfile: 'tmp/browser/test-runner-browser.html'
                }
            },
            relativeUrls: {
                src: ['test/browser/less/relative-urls/*.less'],
                options: {
                    helpers: 'test/browser/runner-relative-urls-options.js',
                    specs: 'test/browser/runner-relative-urls-spec.js',
                    outfile: 'tmp/browser/test-runner-relative-urls.html'
                }
            },
            rootpath: {
                src: ['test/browser/less/rootpath/*.less'],
                options: {
                    helpers: 'test/browser/runner-rootpath-options.js',
                    specs: 'test/browser/runner-rootpath-spec.js',
                    outfile: 'tmp/browser/test-runner-rootpath.html'
                }
            },
            rootpathRelative: {
                src: ['test/browser/less/rootpath-relative/*.less'],
                options: {
                    helpers: 'test/browser/runner-rootpath-relative-options.js',
                    specs: 'test/browser/runner-rootpath-relative-spec.js',
                    outfile: 'tmp/browser/test-runner-rootpath-relative.html'
                }
            },
            production: {
                src: ['test/browser/less/production/*.less'],
                options: {
                    helpers: 'test/browser/runner-production-options.js',
                    specs: 'test/browser/runner-production-spec.js',
                    outfile: 'tmp/browser/test-runner-production.html'
                }
            },
            modifyVars: {
                src: ['test/browser/less/modify-vars/*.less'],
                options: {
                    helpers: 'test/browser/runner-modify-vars-options.js',
                    specs: 'test/browser/runner-modify-vars-spec.js',
                    outfile: 'tmp/browser/test-runner-modify-vars.html'
                }
            },
            globalVars: {
                src: ['test/browser/less/global-vars/*.less'],
                options: {
                    helpers: 'test/browser/runner-global-vars-options.js',
                    specs: 'test/browser/runner-global-vars-spec.js',
                    outfile: 'tmp/browser/test-runner-global-vars.html'
                }
            },
            postProcessorPlugin: {
                src: ['test/less/postProcessorPlugin/*.less'],
                options: {
                    helpers: ['test/plugins/postprocess/index.js','test/browser/runner-postProcessorPlugin-options.js'],
                    specs: 'test/browser/runner-postProcessorPlugin.js',
                    outfile: 'tmp/browser/test-runner-post-processor-plugin.html'
                }
            },
            preProcessorPlugin: {
                src: ['test/less/preProcessorPlugin/*.less'],
                options: {
                    helpers: ['test/plugins/preprocess/index.js','test/browser/runner-preProcessorPlugin-options.js'],
                    specs: 'test/browser/runner-preProcessorPlugin.js',
                    outfile: 'tmp/browser/test-runner-pre-processor-plugin.html'
                }
            },
            visitorPlugin: {
                src: ['test/less/visitorPlugin/*.less'],
                options: {
                    helpers: ['test/plugins/visitor/index.js','test/browser/runner-VisitorPlugin-options.js'],
                    specs: 'test/browser/runner-VisitorPlugin.js',
                    outfile: 'tmp/browser/test-runner-visitor-plugin.html'
                }
            },
            filemanagerPlugin: {
                src: ['test/less/filemanagerPlugin/*.less'],
                options: {
                    helpers: ['test/plugins/filemanager/index.js','test/browser/runner-filemanagerPlugin-options.js'],
                    specs: 'test/browser/runner-filemanagerPlugin.js',
                    outfile: 'tmp/browser/test-runner-filemanager-plugin.html'
                }
            }            
        },

        'saucelabs-jasmine': sauceJobs,

        //     {
        //     all: {
        //         options: {
        //             urls: ["filemanager-plugin","visitor-plugin","pre-processor-plugin","post-processor-plugin","global-vars", "modify-vars", "production", "rootpath-relative",
        //                    "rootpath", "relative-urls", "browser", "no-js-errors", "legacy", "strict-units"
        //             ].map(function(testName) {
        //                 return "http://localhost:8081/tmp/browser/test-runner-" + testName + ".html";
        //             }),
        //             testname: 'Sauce Unit Test for less.js',
        //             browsers: browsers,
        //             public: 'public',
        //             pollInterval: 2000,
        //             statusCheckAttempts: 30,
        //             recordVideo: false,
        //             videoUploadOnPass: false,
        //             recordScreenshots: process.env.TRAVIS_BRANCH !== "master",
        //             build: process.env.TRAVIS_BRANCH === "master" ? process.env.TRAVIS_JOB_ID : undefined,
        //             tags: [process.env.TRAVIS_BUILD_NUMBER, process.env.TRAVIS_PULL_REQUEST, process.env.TRAVIS_BRANCH],
        //             sauceConfig: {
        //                 'idle-timeout': 100
        //             },
        //             throttled: 5,
        //             onTestComplete: function(result, callback) {
        //                 // Called after a unit test is done, per page, per browser
        //                 // 'result' param is the object returned by the test framework's reporter
        //                 // 'callback' is a Node.js style callback function. You must invoke it after you
        //                 // finish your work.
        //                 // Pass a non-null value as the callback's first parameter if you want to throw an
        //                 // exception. If your function is synchronous you can also throw exceptions
        //                 // directly.
        //                 // Passing true or false as the callback's second parameter passes or fails the
        //                 // test. Passing undefined does not alter the test result. Please note that this
        //                 // only affects the grunt task's result. You have to explicitly update the Sauce
        //                 // Labs job's status via its REST API, if you want so.
                
        //                 // This should be the encrypted value in Travis
        //                 var user = process.env.SAUCE_USERNAME;
        //                 var pass = process.env.SAUCE_ACCESS_KEY;

        //                 require('request').put({
        //                     url: ['https://saucelabs.com/rest/v1', user, 'jobs', result.job_id].join('/'),
        //                     auth: { user: user, pass: pass },
        //                     json: { passed: result.passed }
        //                 }, function (error, response, body) {
        //                   if (error) {
        //                     callback(error);
        //                   } else if (response.statusCode !== 200) {
        //                     callback(new Error('Unexpected response status'));
        //                   } else {
        //                     callback(null, result.passed);
        //                   }
        //                 });
        //             }
        //         }
        //     }
        // },

        // Clean the version of less built for the tests
        clean: {
            test: ['test/browser/less.js', 'tmp', 'test/less-bom'],
            "sourcemap-test": ['test/sourcemaps/*.css', 'test/sourcemaps/*.map'],
            sauce_log: ["sc_*.log"]
        }
    });

    // Load these plugins to provide the necessary tasks
    grunt.loadNpmTasks('grunt-saucelabs');
    require('jit-grunt')(grunt);

    // Actually load this plugin's task(s).
    grunt.loadTasks('build/tasks');

    // by default, run tests
    grunt.registerTask('default', [
        'test'
    ]);

    // Release
    grunt.registerTask('dist', [
        'browserify:browser',
        'concat:dist',
        'uglify:dist'
    ]);

    // Release Rhino Version
    grunt.registerTask('rhino', [
        'browserify:rhino',
        'concat:rhino',
        'concat:rhinolessc'
    ]);

    // Create the browser version of less.js
    grunt.registerTask('browsertest-lessjs', [
        'browserify:browser',
        'uglify:test',
        'concat:browsertest'
    ]);

    // Run all browser tests
    grunt.registerTask('browsertest', [
        'browsertest-lessjs',
        'connect',
        'jasmine'
    ]);

    // setup a web server to run the browser tests in a browser rather than phantom
    grunt.registerTask('browsertest-server', [
        'browsertest-lessjs',
        'jasmine::build',
        'connect::keepalive'
    ]);

    var previous_force_state = grunt.option("force");

    grunt.registerTask("force",function(set) {
        if (set === "on") {
            grunt.option("force",true);
        }
        else if (set === "off") {
            grunt.option("force",false);
        }
        else if (set === "restore") {
            grunt.option("force",previous_force_state);
        }
    });

    grunt.registerTask('sauce', [
        'browsertest-lessjs',
        'jasmine::build',
        'connect',
        'sauce-after-setup'
    ]);

    var sauceTests = [];
    browserTests.map(function(testName) {
        sauceTests.push('saucelabs-jasmine:' + testName);
    });
    sauceTests.push('clean:sauce_log');
    grunt.registerTask('sauce-after-setup', sauceTests);

    var testTasks = [
        'clean',
        'jshint',
        'jscs',
        'shell:test',
        'browsertest'
    ];

    if (isNaN(Number(process.env.TRAVIS_PULL_REQUEST, 10)) &&
        Number(process.env.TRAVIS_NODE_VERSION) === 4 &&
        (process.env.TRAVIS_BRANCH === "master" || process.env.TRAVIS_BRANCH === "3.x")) {
        testTasks.push("force:on");
        testTasks.push("sauce-after-setup");
        testTasks.push("force:off");
    }

    // Run all tests
    grunt.registerTask('test', testTasks);

    // Run all tests
    grunt.registerTask('quicktest', testTasks.slice(0, testTasks.length -1));

    // generate a good test environment for testing sourcemaps
    grunt.registerTask('sourcemap-test', [
        'clean:sourcemap-test',
        'shell:sourcemap-test',
        'connect::keepalive'
    ]);

    // Run benchmark
    grunt.registerTask('benchmark', [
        'shell:benchmark'
    ]);

};
