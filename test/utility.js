'use strict'

var test = require('tape')

test('NGNX Utilities', function (t) {
  t.ok(NGNX.hasOwnProperty('util'), 'NGNX.util exists.')
  t.ok(typeof NGNX.util.requeue === 'function', 'NGNX.util.requeue exists.')
  t.ok(typeof NGNX.util.guaranteeVariable === 'function', 'NGNX.util.guaranteeVariable exists.')

  // Account for Sauce Labs delayed loading time.
  setTimeout(t.end, 1000)
})

test('NGNX.util.guaranteeVariable', function (t) {
  NGNX.util.guaranteeVariable('myVar', function (variableName, value) {
    t.pass('Callback executed.')
    t.ok(variableName === 'myVar', 'Responds with the proper variable name.')
    t.ok(value === null, 'Responds with the proper variable value.')

    t.end()
  })

  setTimeout(function () {
    window.myVar = null
  }, 600)
})
