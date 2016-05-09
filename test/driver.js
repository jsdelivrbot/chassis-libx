'use strict'

var test = require('tape')

test('Global', function (t) {
  var Model = new NGN.DATA.Model({
    fields: {
      test: null
    }
  })
  var Models = new NGN.DATA.Store({
    model: Model
  })

  var MyController = new NGNX.Driver({
    scope: 'test.',
    references: {
      test: '#test1'
    },
    stores: {
      mystore: Models
    },
    templates: {
      test: './test/test.html'
    }
  })

  t.ok(NGN.ref.test !== undefined, 'Reference created.')
  t.ok(MyController.store.hasOwnProperty('mystore'), 'Store registered successfully.')

  NGN.BUS.on('test.record.create', function (record) {
    t.pass('Scoped event bubbling successfully triggered on NGN.BUS.')
    t.ok(record.test === 'test', 'Data update recognized.')
    // MyController.render('test', {}, function (el) {
      // t.ok(el instanceof Element, 'A proper element was returned by the template reference.')
    t.end()
    // })
  })

  MyController.store.mystore.add({
    test: 'test'
  })
})