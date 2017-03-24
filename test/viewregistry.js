'use strict'

var test = require('tape')

test('NGNX.ViewRegistry Sanity Checks', function (t) {
  t.ok(NGNX.hasOwnProperty('ViewRegistry'), 'NGNX.ViewRegistry exists.')

  var myReg
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

test('NGNX.ViewRegistry Reactions', function (t) {
  document.body.insertAdjacentHTML('beforeend', '<div class="panel"><footer></footer></div>')

  // Main View Registry
  var Connection = new NGNX.ViewRegistry({
    namespace: 'connection.',
    selector: '.panel',
    properties: {
      title: String
    },
    states: {
      offline: function (change) {
        this.properties.title = 'Offline'
      },

      online: function (change) {
        this.properties.title = 'Online'
      }
    },
    initialState: 'offline'
  })

  // Child View Registry (Inherits from Parent)
  var ConnectionNavigation = new NGNX.ViewRegistry({
    parent: Connection,
    selector: 'footer',
    namespace: 'navigation.',
    states: {
      connected: function () {},
      disconnected: function () {}
    },

    // Reactions automatically map parent state changes to the child
    reactions: {
      online: 'connected',
      offline: 'disconnected'
    }
  })

  // Basic navigation
  Connection.state = 'online'
  t.ok(ConnectionNavigation.state === 'connected', 'Reaction cascades properly.')
  t.ok(Connection.properties.title === 'Online', 'Properties set properly.')

  Connection.state = 'offline'
  t.ok(ConnectionNavigation.state === 'disconnected', 'Reaction change cascades properly.')
  t.ok(Connection.properties.title === 'Offline', 'Property value changes occur correctly.')

  t.end()
})

test('NGNX.ViewRegistry Reflexes', function (t) {
  // Independent View Registry
  var RegA = new NGNX.ViewRegistry({
    namespace: 'rega.',
    selector: '.panel',
    states: {
      offline: function (change) {},
      online: function (change) {}
    },
    initialState: 'offline'
  })

  var RegB = new NGNX.ViewRegistry({
    selector: 'footer',
    namespace: 'regb.',
    states: {
      connected: function () {},
      disconnected: function () {}
    },

    reflexes: {
      registry: RegA,
      reactions: {
        online: 'connected',
        offline: 'disconnected'
      }
    }
  })

  // Basic navigation
  RegA.state = 'online'
  t.ok(RegB.state === 'connected', 'Reflex applied properly.')

  RegA.state = 'offline'
  t.ok(RegB.state === 'disconnected', 'Reflex change cascades properly.')

  t.end()
})

test('Initialization', function (t) {
  var x = -1

  // Independent View Registry
  var RegC = new NGNX.ViewRegistry({
    namespace: 'regc.',
    selector: '.panel',
    states: {
      offline: function (change) {},
      online: function (change) {}
    },
    init: function (next) {
      x = 1
      next()
    },
    initialState: 'offline'
  })

  RegC.on('initialized', function () {
    t.ok(x === 1, 'Initialization ran successfully.')
    t.end()
  })
})
