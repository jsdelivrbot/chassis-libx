'use strict'

var test = require('tape')

test('NGNX.VIEW.Registry Sanity Checks', function (t) {
  t.ok(NGNX.VIEW.hasOwnProperty('Registry'), 'NGNX.VIEW.Registry exists.')

  var myReg
  try {
    myReg = new NGNX.VIEW.Registry()
    t.fail('Instantiated with bad configuration.')
  } catch (e) {
    t.pass('Bad configuration throws an error.')
  }

  myReg = new NGNX.VIEW.Registry({
    selector: '#test1'
  })

  t.ok(typeof myReg === 'object', 'Creating a new view registry returns a usable object/class')

  t.end()
})

test('NGNX.VIEW.Registry Reactions', function (t) {
  document.body.insertAdjacentHTML('beforeend', '<div class="panel"><footer></footer></div>')

  // Main View Registry
  var Connection = new NGNX.VIEW.Registry({
    namespace: 'connection.',
    selector: '.panel',
    properties: {
      title: String
    },
    states: {
      offline: function (change) {
        this.properties.title = 'Offline'
      },

      onLine: function (change) {
        this.properties.title = 'Online'
      }
    },
    initialState: 'offline'
  })

  // Child View Registry (Inherits from Parent)
  var ConnectionNavigation = new NGNX.VIEW.Registry({
    parent: Connection,
    selector: 'footer',
    namespace: 'navigation.',
    states: {
      connected: function () {},
      disconnected: function () {}
    },

    // Reactions automatically map parent state changes to the child
    reactions: {
      onLine: 'connected',
      offline: 'disconnected'
    }
  })

  // Basic navigation
  Connection.state = 'onLine'
  t.ok(ConnectionNavigation.state === 'connected', 'Reaction cascades properly.')
  t.ok(Connection.properties.title === 'Online', 'Properties set properly.')

  Connection.state = 'offline'
  t.ok(ConnectionNavigation.state === 'disconnected', 'Reaction change cascades properly.')
  t.ok(Connection.properties.title === 'Offline', 'Property value changes occur correctly.')

  t.end()
})

test('NGNX.VIEW.Registry Reflexes', function (t) {
  // Independent View Registry
  var RegA = new NGNX.VIEW.Registry({
    namespace: 'rega.',
    selector: '.panel',
    states: {
      offline: function (change) {},
      online: function (change) {}
    },
    initialState: 'offline'
  })

  var RegB = new NGNX.VIEW.Registry({
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

test('Async Initialization', function (t) {
  var x = -1

  // Independent View Registry
  var RegC = new NGNX.VIEW.Registry({
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

test('Sync Initialization', function (t) {
  var x = -1

  // Independent View Registry
  var RegD = new NGNX.VIEW.Registry({
    namespace: 'regd.',
    selector: '.panel',
    states: {
      offline: function (change) {},
      online: function (change) {}
    },
    init: function () {
      x = 1
    },
    initialState: 'offline'
  })

  RegD.on('initialized', function () {
    t.ok(x === 1, 'Initialization ran successfully.')
    t.end()
  })
})

test('Extended References (Generated Names via Nesting)', function (t) {
  var RegD = new NGNX.VIEW.Registry({
    namespace: 'regd.',
    selector: '.panel',
    references: {
      a: {
        d: {
          o: {
            g: '.test'
          },
          e: '.test'
        }
      }
    }
  })

  t.ok(RegD.ref.hasOwnProperty('aDOG'), 'Properly generated name.')
  t.end()
})
