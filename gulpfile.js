'use strict'

require('localenvironment')
const gulp = require('gulp')
const concat = require('gulp-concat')
const uglify = require('gulp-uglify')
const babel = require('gulp-babel')
const cp = require('child_process')
const header = require('gulp-header')
const footer = require('gulp-footer')
const sourcemaps = require('gulp-sourcemaps')
const ShortBus = require('shortbus')
const del = require('del')
const MustHave = require('musthave')
const mh = new MustHave({
  throwOnError: false
})
const GithubPublisher = require('publish-release')
const fs = require('fs')
const path = require('path')
const pkg = require('./package.json')
let headerComment = '/**\n  * v' + pkg.version + ' generated on: '
  + (new Date()) + '\n  * Copyright (c) 2014-' + (new Date()).getFullYear()
  + ', Ecor Ventures LLC. All Rights Reserved. See LICENSE (BSD).\n  */\n'

var DIR = {
  source: path.resolve('./src'),
  dist: path.resolve('./dist')
}

// Build a release
gulp.task('build', ['clean', 'generate'])

// Check versions for Bower & npm
// gulp.task('version', function (next) {
//   console.log('Checking versions.')
//
//   // Sync Bower
//   var bower = require('./bower.json')
//   if (bower.version !== pkg.version) {
//     console.log('Updating bower package.')
//     bower.version = pkg.version
//     fs.writeFileSync(path.resolve('./bower.json'), JSON.stringify(bower, null, 2))
//   }
// })

// Create a clean build
gulp.task('clean', function (next) {
  console.log('Cleaning distribution.')
  try {
    fs.accessSync(DIR.dist, fs.F_OK)
    del.sync(DIR.dist)
  } catch (e) {}
  fs.mkdirSync(DIR.dist)
  next()
})

const common = [
  'utility.js',
  'data/httpproxy.js',
  'driver.js',
  'loader.js',
  'state.js',
  'task.js',
  'taskrunner.js',
  'view/registry.js',
  'view/component.js'
]

const minifyConfig = {
  presets: ['es2015', 'es2017'],
  mangle: true,
  compress: {
    dead_code: true,
    global_defs: {
      DEBUG: false
    },
    warnings: true,
    drop_debugger: true,
    unused: true,
    if_return: true,
    passes: 3
  }
}

const babelConfig = {
  presets: ['es2015', 'es2017']
}

const expand = function (array) {
  return array.map(function (file) {
    return path.join(DIR.source, file)
  })
}

const walk = function (dir) {
  let files = []
  fs.readdirSync(dir).forEach(function (filepath) {
    filepath = path.join(dir, filepath)
    const stat = fs.statSync(filepath)
    if (stat.isDirectory()) {
      files = files.concat(walk(filepath))
    } else {
      files.push(filepath)
    }
  })
  return files
}

require('colors')
gulp.task('generate', function () {
  console.log('Generating distribution files in ', DIR.dist)
  const tasks = new ShortBus()
  const mapRoot = 'https://cdn.author.io/ngnx/' + pkg.version
  const srcmapcfg = {
    includeContent: true,
    sourceMappingURL: function (file) {
      return mapRoot + '/' + file.relative + '.map'
    },
    sourceURL: function (file) {
      return file.relative.replace('.min.js', '.js')
    }
  }

  common.forEach(function (filename) {
    tasks.add('Generating common file:' + filename, function (cont) {
      gulp.src(path.join(DIR.source, filename))
        .pipe(concat(filename.replace('.js', '.min.js').replace(path.sep, '.')))
        .pipe(babel(babelConfig))
        .pipe(uglify(minifyConfig))
        .pipe(header(headerComment))
        .pipe(sourcemaps.write('./sourcemaps', srcmapcfg))
        .pipe(gulp.dest(DIR.dist))
        .on('end', cont)
    })
  })

  // Generate debug library
  tasks.add('Generating debug version: debug.js', function (cont) {
    gulp.src(expand(common))
      .pipe(concat('debug.js'))
      .pipe(babel(babelConfig))
      .pipe(header(headerComment))
      .pipe(footer(`\nObject.defineProperty(NGNX, 'version', NGN.const('${pkg.version}')); console.warn('%cDebugging%c NGNX v${pkg.version}.', 'font-weight: bold;', 'font-weight: normal')`))
      .pipe(gulp.dest(DIR.dist))
      .on('end', cont)
  })

  // Generate production library
  tasks.add('Generate production library: complete.min.js', function (cont) {
    return gulp.src(expand(common))
      .pipe(concat('complete.min.js'))
      .pipe(babel(babelConfig))
      .pipe(uglify(minifyConfig))
      .pipe(header(headerComment))
      .pipe(footer(`\nObject.defineProperty(NGNX, 'version', NGN.const('${pkg.version}'))`))
      .pipe(sourcemaps.write('./sourcemaps', srcmapcfg))
      .pipe(gulp.dest(DIR.dist))
      .on('end', cont)
  })

  tasks.on('stepstarted', (step) => {
    console.log(step.number + ')', step.name)
  })

  tasks.process(true)
})

gulp.task('prereleasecheck', function (next) {
  console.log('Checking if package already exists.')
  const child = cp.spawn('npm', ['info', pkg.name])

  let data = ""
  child.stdout.on('data', function (chunk) {
    data += chunk.toString()
  })
  child.on('close', function () {
    const re = new RegExp('latest: \'' + pkg.version + '\'')
    if (re.exec(data) === null) {
      next()
    } else {
      console.log('The version has not changed (' + pkg.version + '). A new release is unnecessary. Aborting deployment with success code.')
      process.exit(0)
    }
  })
})

gulp.task('release', function (next) {
  console.log('Checking if package already exists.')
  const child = cp.spawn('npm', ['info', pkg.name])

  let data = ""
  child.stdout.on('data', function (chunk) {
    data += chunk.toString()
  })
  child.on('close', function () {
    const re = new RegExp('latest: \'' + pkg.version + '\'')
    if (re.exec(data) === null) {
      if (!mh.hasAll(process.env, 'GITHUB_TOKEN', 'GITHUB_ACCOUNT', 'GITHUB_REPO')) {
        throw new Error('Release not possible. Missing data: ' + mh.missing.join(', '))
      }

      // Check if the release already exists.
      const https = require('https')

      https.get({
        hostname: 'api.github.com',
        path: '/repos/' + process.env.GITHUB_ACCOUNT + '/' + process.env.GITHUB_REPO + '/releases',
        headers: {
          'user-agent': 'Release Checker'
        }
      }, function (res) {
        let data = ""
        res.on('data', function (chunk) {
          data += chunk
        })

        res.on('error', function (err) {
          throw err
        })

        res.on('end', function () {
          data = JSON.parse(data).filter(function (release) {
            return release.tag_name === pkg.version
          })

          if (data.length > 0) {
            console.log('Release ' + pkg.version + ' already exists. Aboting without error.')
            process.exit(0)
          }

          const assets = walk(DIR.dist).sort()

          GithubPublisher({
            token: process.env.GITHUB_TOKEN,
            owner: process.env.GITHUB_ACCOUNT,
            repo: process.env.GITHUB_REPO,
            tag: pkg.version,
            name: pkg.version,
            notes: 'Releasing v' + pkg.version,
            draft: false,
            prerelease: false,
            reuseRelease: true,
            reuseDraftOnly: true,
            assets: assets,
            // apiUrl: 'https://myGHEserver/api/v3',
            target_commitish: 'master'
          }, function (err, release) {
            if (err) {
              err.errors.forEach(function (e) {
                console.error((e.resource + ' ' + e.code).red.bold)
              })
              process.exit(1)
            }
            console.log(release)
          })
        })
      })
    }
  })
})
