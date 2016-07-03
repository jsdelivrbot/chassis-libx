'use strict'

var test = require('tape')

test('NGNX.Driver', function (t) {
  console.log('BP1')
  var Model = new NGN.DATA.Model({
    fields: {
      test: null
    }
  })
  console.log('BP2')
  var Models = new NGN.DATA.Store({
    model: Model
  })
console.log('BP3')
  var MyController = new NGNX.Driver({
    namespace: 'test.',
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
  console.log(document.getElementById('test1'))
console.log('BP4')
  t.ok(NGN.ref.test !== undefined, 'Reference created.')
console.log('BP4.5')
  t.ok(MyController.store.hasOwnProperty('mystore'), 'Store registered successfully.')
console.log('BP5')
  NGN.BUS.on('test.record.create', function (record) {
    t.pass('Scoped event bubbling successfully triggered on NGN.BUS.')
    t.ok(record.test === 'test', 'Data update recognized.')
    // MyController.render('test', {}, function (el) {
    // t.ok(el instanceof Element, 'A proper element was returned by the template reference.')
    MyController.pool('extra.', {
      demo: function () {
        NGN.BUS.emit('all.done')
      }
    })

    NGN.BUS.once('all.done', function () {
      t.pass('Driver event pooling triggered successfully.')
      NGN.BUS.once('test.scoped.event.received', function () {
        t.pass('Driver.emit() properly scopes an event on the NGN.BUS.')
        t.end()
      })
      MyController.emit('scoped.event.received')
    })

    NGN.BUS.emit('test.extra.demo')

    // })
  })

  MyController.store.mystore.add({
    test: 'test'
  })
})
