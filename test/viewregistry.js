'use strict'

var test = require('tape')

test('NGNX.ViewRegistry Sanity Checks', function (t) {
  t.ok(typeof NGNX.ViewRegistry === 'function', 'NGNX.ViewRegistry exists as a class.')

  let myReg
  try {
    myReg = new NGNX.ViewRegistry()
    t.fail('Instantiated with bad configuration.')
  } catch (e) {
    t.pass('Bad configuration throws an error.')
  }

  myReg = new NGNX.ViewRegistry({
    selector: '#test1'
  })

  t.ok(typeof myReg === 'object', 'Creating a new view registry returns a usable object/class')

  t.end()
})
