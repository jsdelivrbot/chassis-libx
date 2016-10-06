'use strict'

var test = require('tape')

test('NGNX Base', function (t) {
  t.ok(window.NGN !== undefined, 'NGN namespace exists.')
  t.ok(window.NGNX !== undefined, 'NGNX namespace exists.')
  t.ok(typeof window.NGNX.DATA.HttpProxy === 'function', 'NGNX.DATA.HttpProxy is a recognized class.')
  t.ok(NGNX.hasOwnProperty('statechangerecorded'), 'State management added to NGN.BUS')
  t.ok(typeof window.NGNX.Driver === 'function', 'NGNX.Driver is a recognized class.')

  // Account for Sauce Labs delayed loading time.
  setTimeout(t.end, 1000)
})
