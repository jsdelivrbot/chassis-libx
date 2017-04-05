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
      offline: function () {},
      online: function () {}
    },
    init: function (next) {
      x = 1
      next()
    },
    initialState: 'offline'
  })

  RegC.on('initialized', function () {
    t.ok(x === 1, 'Asynchronous Initialization ran successfully.')
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

  RegD.once('initialized', function () {
    t.ok(x === 1, 'Synchronous Initialization ran successfully.')
    t.end()
  })
})

test('Extended References (Generated Names via Nesting)', function (t) {
  var RegE = new NGNX.VIEW.Registry({
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

  t.ok(RegE.ref.hasOwnProperty('aDOG'), 'Properly generated name.')
  t.end()
})

test('Pre & Post-state-change Hooks', function (t) {
  var x = 0
  var y = 0

  var RegF = new NGNX.VIEW.Registry({
    namespace: 'regE.',
    selector: '.panel',
    states: {
      offline: function () {
        t.fail('Did not short circuit when false was returned from prestate.')
      },
      online: function () {
        t.ok(x === 1, 'Executed pre-state hook before state change.')
        t.ok(y === 2, 'Executed global pre-state hook before state change.')

        x = 10
      }
    },

    preStates: {
      '*': function (currentState, proposedState, next) {
        y++

        setTimeout(function () {
          next()
        }, 300)
      },

      online: function (currentState, proposedState) {
        t.ok(currentState === 'default', 'Proper current state passed to async handler.')
        t.ok(proposedState === 'online', 'Proper proposed state passed to async handler.')

        x++
      },

      offline: function () {
        return false
      }
    },

    postStates: {
      '*': function () {
        t.ok(x === 10, 'Global post-state-change triggered successfully.')

        x++
      },

      online: function () {
        t.ok(x === 11, 'Specific post-state-change triggered successfully.')
        t.end()
      }
    }
  })

  RegF.state = 'offline'
  RegF.state = 'online'
})
