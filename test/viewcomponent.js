'use strict'

var test = require('tape')

test('NGNX.VIEW.Component Sanity Checks', function (t) {
  t.ok(NGNX.VIEW.hasOwnProperty('Registry'), 'NGNX.VIEW.Registry exists.')
  t.ok(NGNX.VIEW.hasOwnProperty('Component'), 'NGNX.VIEW.Component exists.')

  var myRegComponent
  try {
    myRegComponent = new NGNX.VIEW.Component()
    t.fail('Instantiated with bad configuration.')
  } catch (e) {
    t.pass('Bad configuration throws an error.')
  }

  myRegComponent = new NGNX.VIEW.Component({
    element: document.querySelector('#test1')
  })

  t.ok(typeof myRegComponent === 'object', 'Creating a new view registry returns a usable object/class')

  t.end()
})
