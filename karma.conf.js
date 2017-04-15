'use strict'

// The last command line argument.
const mode = (process.env.hasOwnProperty('BUILD_MODE') ? process.env.BUILD_MODE : 'dev').toLowerCase()

// Karma configuration
// Generated on Thu Nov 12 2015 07:04:29 GMT-0600 (CST)
require && require('localenvironment')

var _browser
var caniuse
var useDistributionFiles = null
var reporterEngines = ['spec']
var customLaunchers = {}
var browsers = ['chrome']
var sauceConfiguration = {
  testName: 'NGNX Chassis JS Lib Unit Tests',
  build: process.env.SEMAPHORE_BUILD_NUMBER || 1,
  recordVideo: false,
  recordScreenshots: false
}

switch (mode) {
  case 'live':
    console.warn('Running a live developer test.')
    useDistributionFiles = false

  case 'prod': // eslint-disable-line no-fallthrough
    useDistributionFiles = typeof useDistributionFiles === 'boolean' ? useDistributionFiles : true

    // Latest Browsers
    caniuse = require('caniuse-api')
    var lb = caniuse.getLatestStableBrowsers() // eslint-disable-line no-unused-vars

    browsers.push('firefox')

    var b = {}
    lb = lb.forEach(function (item, index, arr) {
      item = item.split(' ')
      b[item[0].toLowerCase()] = item[1]
    })

    Object.keys(b).forEach(function (browser) {
      var version = b[browser]
      var willtest = false // eslint-disable-line no-unused-vars

      // if (browser === 'firefox') {
      //   version -= 1
      // }

      if (browsers.indexOf(browser) >= 0 || // eslint-disable-line no-mixed-operators
        !useDistributionFiles && browser === 'edge' || // eslint-disable-line no-mixed-operators
        (useDistributionFiles && ['edge', 'ie', 'safari'].indexOf(browser) >= 0)) {
        willtest = true
      }

      // console.info('  - ' + browser + ':', version + (willtest ? ' ---> WILL BE TESTED' : ''))

      if (browsers.indexOf(browser) >= 0) {
        // version = version - 1
        customLaunchers['cl_' + browser + '_' + version.toString()] = {
          base: 'SauceLabs',
          browserName: browser,
          version: browser === 'chrome' ? 55 : (browser === 'firefox' ? 50 : version)
        }
      }
    })

    customLaunchers.cl_edge_20 = {
      base: 'SauceLabs',
      browserName: 'MicrosoftEdge',
      platform: 'Windows 10',
      version: '14.14393'
    }

    if (useDistributionFiles) {
      customLaunchers.cl_safari_8 = {
        base: 'SauceLabs',
        browserName: 'safari',
        platform: 'OS X 10.10',
        version: '8'
      }

      customLaunchers.cl_safari_9 = {
        base: 'SauceLabs',
        browserName: 'safari',
        platform: 'OS X 10.11',
        version: '9'
      }

      customLaunchers.cl_safari_10 = {
        base: 'SauceLabs',
        browserName: 'safari',
        platform: 'OS X 10.12',
        version: '10'
      }

      customLaunchers.cl_ie_11 = {
        base: 'SauceLabs',
        browserName: 'internet explorer',
        platform: 'Windows 10',
        version: '11'
      }

      customLaunchers.cl_chrome_45 = {
        base: 'SauceLabs',
        browserName: 'chrome',
        platform: 'Windows 7',
        version: '45'
      }

      customLaunchers.cl_firefox_50 = {
        base: 'SauceLabs',
        browserName: 'firefox',
        platform: 'Windows 7',
        version: '50'
      }
    }

    console.log('Testing Browsers:')
    Object.keys(customLaunchers).forEach(function (launcher) {
      console.info('  - ' + customLaunchers[launcher].browserName + ':', customLaunchers[launcher].version)
    })

    sauceConfiguration.tunnelIdentifier = process.env.SEMAPHORE_PROJECT_HASH_ID
    sauceConfiguration.username = process.env.SAUCE_USERNAME
    sauceConfiguration.accessKey = process.env.SAUCE_ACCESS_KEY
    sauceConfiguration.startConnect = true
    sauceConfiguration.connectOptions = {
      port: 5757,
      logfile: 'sauce_connect.log',
      logger: function (message) {
        console.log('[SAUCECONNECT]', message)
      }
    }

    reporterEngines.unshift('saucelabs')

    break

  default:
    useDistributionFiles = false
    // dev mode
    _browser = 'Chrome'
    if (process.argv.indexOf('--firefox') >= 0) {
      _browser = 'Firefox'
    }

    if (process.argv.indexOf('--safari') >= 0) {
      _browser = 'Safari'
    }

    if (process.argv.indexOf('--edge') >= 0) {
      _browser = 'Edge'
    }
    break
}

var getFiles = function () {
  var files

  if (useDistributionFiles) {
    files = [
      'dist/complete.min.js'
    ]
  } else {
    files = [
      'src/reference/HTMLReferenceElement.js',
      'src/reference/Manager.js',
      'src/utility.js',
      'src/data/httpproxy.js',
      'src/driver.js',
      'src/loader.js',
      'src/state.js',
      'src/task.js',
      'src/taskrunner.js',
      'src/view/registry.js',
      'src/view/component.js'
    ]
  }

  // let allfiles = ['https://rawgit.com/ngnjs/cdn/master/chassis-lib/chassis.legacy.min.js']
  let cb = (new Date()).getTime().toString()
  console.log('Cache buster:', cb)
  let allfiles = ['https://cdn.author.io/ngn/latest/legacy.complete.min.js?cachebust=' + cb]
  // let allfiles = ['https://cdn.author.io/ngn/1.0.199/chassis.min.js']
  allfiles = allfiles.concat(files)
  allfiles.push('test/*.js')
  allfiles.push({
    pattern: 'test/*.html',
    served: true,
    nocache: true
  })

  console.log('Including Files:\n', allfiles)

  return allfiles
}

module.exports = function (config) {
  // If a distribution is required, make it.
  if (useDistributionFiles) {
    const cp = require('child_process')
    console.info('Building distribution files.')
    cp.execSync('gulp build')
    setTimeout(function () {
      console.info('Distribution ready.')
    }, 2000)
  }

  config.set({
    browserDisconnectTimeout: 120000,
    browserDisconnectTolerance: 10,
    browserNoActivityTimeout: 120000,

    specReporter: {
      maxLogLines: 5,         // limit number of lines logged per test
      suppressErrorSummary: mode !== 'dev',  // do not print error summary
      suppressFailed: false,  // do not print information about failed tests
      suppressPassed: true,  // do not print information about passed tests
      suppressSkipped: true,  // do not print information about skipped tests
      showSpecTiming: false // print the time elapsed for each spec
    },

    sauceLabs: sauceConfiguration,

    customLaunchers: customLaunchers,

    plugins: [
      require('karma-browserify'),
      require('tape'),
      require('karma-tap'),
      require('karma-spec-reporter'),
      require('karma-chrome-launcher'),
      require('karma-firefox-launcher'),
      require('karma-safari-launcher'),
      require('karma-ie-launcher'),
      require('karma-edge-launcher'),
      require('karma-phantomjs-launcher'),
      require('karma-sauce-launcher'),
      require('karma-html2js-preprocessor')
    ],

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['tap', 'browserify'],

    // list of files / patterns to load in the browser
    files: getFiles(),

    // list of files to exclude
    exclude: [],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'test/*.js': [ 'browserify' ],
      'test/test.html': 'html2js'
    },

    browserify: {
      debug: false
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: reporterEngines,

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: mode === 'dev' ? config.LOG_DEBUG : config.LOG_WARN,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: mode === 'dev' ? [_browser] : Object.keys(customLaunchers),
    // ['Chrome', 'Firefox', 'Safari', 'Opera', 'IE'],

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // Concurrency level
    // how many browsers should be started simultanous
    concurrency: 3
  })
}
