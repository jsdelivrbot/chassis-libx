'use strict'

var test = require('tape')

test('NGNX Utilities', function (t) {
  t.ok(NGNX.hasOwnProperty('util'), 'NGNX.util exists.')
  t.ok(typeof NGNX.util.requeue === 'function', 'NGNX.util.requeue exists.')

  // Account for Sauce Labs delayed loading time.
  setTimeout(t.end, 1000)
})
