'use strict'

var test = require('tape')

test('Sanity Check', function (t) {
  t.ok(NGNX.Loader !== undefined, 'NGNX.Loader exists.')
  t.end()
})

test('Synchronous Loading', {
  timeout: 3000
}, function (t) {
  NGNX.Loader({
    sync: [
      'https://cdnjs.cloudflare.com/ajax/libs/accounting.js/0.4.1/accounting.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/bricks.js/1.7.0/bricks.min.js'
    ]
  }, function (imported) {
    t.pass('Callback triggered')
    t.end()
  })
})
