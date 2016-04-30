/**
  * v1.0.0 generated on: Sat Apr 30 2016 16:02:56 GMT-0500 (CDT)
  * Copyright (c) 2014-2016, Ecor Ventures LLC. All Rights Reserved. See LICENSE (BSD).
  */
'use strict'

if (!NGN) {
  console.error('NGN not found.')
} else {
  window.NGNX = window.NGNX || {}

  /**
   * @class NGNX.Controller
   * Controllers can be used to easily reference different components of an
   * application, such as data stores or DOM elements.
   *
   * NGN is based on the concept of a service bus (NGN.BUS), so the NGNX concept
   * of a controller differs from the tradtional MVC approach in subtle ways.
   * The biggest difference is a controller is designed to trigger events on the
   * bus, but it only responds to select events (or none at all).
   *
   * NGNX.Controller is designed to simplify event triggering and isolate
   * application logic in an opinionated way (keep it brutally simple). See the
   * options associated with each configuration property for specific details.
   *
   * This class was designed to be extended, acting mostly as a standard way to
   * trigger scoped events. It can be extended with any level of logic by adding
   * custom methods, properties, configurations, etc. For more details about
   * extending controllers, see the NGNX Controller guide.
   */
  class _Controller {
    constructor (cfg) {
      cfg = cfg || {}

      Object.defineProperties(this, {
        /**
         * @cfg {string} [scope]
         * The scope is prepended to NGN.BUS events. For example, setting
         * this to `mycontroller.` will trigger events like
         * `mycontroller.eventname` instead of just `eventname`.
         */
        scope: NGN.define(true, false, false, cfg.scope || null),

        /**
         * @cfg {Object} [references]
         * An object of key/values depicting a reference. Each key is the
         * reference name, while each value is a DOM selector pattern. Providing
         * references here is the same as writing `NGN.ref.create('key',
         * 'selector/value')` for each reference (this is a shortcut method).
         * Additionally, these references are associated with the controller for
         * easy access.
         *
         * A reference can be accessed in one of two ways:
         *
         * 1. NGN.ref.key
         * 1. Controller.ref.key or Controller.dom.key
         *
         * ```js
         * var Controller = new NGNX.Controller({
         *   references: {
         *   	 buttons: 'body > button',
         *   	 nav: 'body > header > nav:first-of-type',
         *   	 input: '#myinput'
         *   }
         * })
         *
         * NGN.ref.buttons.forward('click', NGN.BUS.attach('some.event'))
         * // same as
         * Controller.ref.buttons.forward('click', NGN.BUS.attach('some.event'))
         * // same as
         * Controller.dom.buttons.forward('click', NGN.BUS.attach('some.event'))
         * // same as
         * Controller.dom.buttons.addEventListener('click', function (e) {
         *   NGN.BUS.emit('some.event', e)
         * })
         * ```
         *
         * References are global. If a reference already exists, it will **not**
         * be overridden. Instead, a `getter`/pointer to the original reference
         * will be created and a warning will be displayed in the console.
         */
        references: NGN.define(false, false, false, cfg.references || {}),

        /**
         * @cfgproperty {Object} [stores]
         * An object of NGN.DATA.Store references to associate with the controller.
         *
         * ```js
         * var MyStore = new NGN.DATA.Store({
         *   model: MyModel,
         *   allowDuplicates: false
         * })
         *
         * var MyOtherStore = new NGN.DATA.Store({
         *   model: MyOtherModel,
         *   allowDuplicates: false
         * })
         *
         * var Controller = new NGNX.Controller({
         *   datastores: {
         *   	 a: MyStore,
         *   	 b: MyOtherStore
         *   }
         * })
         *
         * console.log(Controller.store.a.records) // dumps the records for MyModel
         * console.log(Controller.store.b.records) // dumps the records for MyOtherModel
         * ```
         * @type {Object}
         */
        datastores: NGN.define(true, false, false, cfg.stores || {}),

        /**
         * @property {Array} events
         * Contains a list of events that can be triggered by this controller.
         * @private
         */
        events: NGN.define(false, true, false, []),

        /**
         * @property {Array} dataevents
         * The supported data events.
         * @hidden
         */
        dataevents: NGN.define(false, false, false, [
          'record.create',
          'record.delete',
          'index.create',
          'index.delete',
          'record.duplicate',
          'record.update'
        ])
      })

      // Generate references
      let me = this
      Object.keys(this.references).forEach(function (r) {
        if (!NGN.ref.hasOwnProperty(r)) {
          NGN.ref.create(r, me[r])
        }
      })

      // For each datastore, listen to the store's events and bubble the event.
      if (this.scope !== null) {
        Object.keys(this.datastores).forEach(function (name) {
          me.scopeStoreEvents(name)
        })
      }
    }

    /**
     * @method addStore
     * Add a new datastore reference to the controller.
     *
     * **Example:**
     *
     * ```js
     * let MyStore = new NGN.DATA.Store({...})
     * let MyController = new NGNX.Controller({
     *   ...
     * })
     *
     * MyController.addStore('mystore', MyStore)
     *
     * console.log(MyController.store.mystore.records) // dumps the records
     * ```
     * @param {String} referenceName
     * The name by which the datastore can be retrieved.
     * @param {NGN.DATA.Store} store
     * The store to reference.
     */
    addStore (name, store) {
      let me = this
      if (this.datastores.hasOwnProperty(name)) {
        if (this.scope !== null) {
          // Remove scoped events.
          this.dataevents.forEach(function (e) {
            NGN.BUS.off(me.scope + e)
          })
        }
        console.warn('Controller already had a reference to ' + name + ', which has been overwritten.')
      }
      this.datastores[name] = store
      this.scopeStoreEvents(name)
    }

    /**
     * @method scopeStoreEvents
     * Apply the #scope prefix to each datastore event.
     * @param {String} name
     * The controller reference name to the store.
     * @param {boolean} suppressWarning
     * Suppress the warning message if the scope is not defined.
     * @private
     */
    scopeStoreEvents (name, suppress) {
      suppress = NGN.coalesce(suppress, false)
      if (this.scope !== null) {
        let me = this
        this.dataevents.forEach(function (e) {
          me.datastores[name].on(e, function (model) {
            NGN.BUS.emit(me.scope + e, model)
          })
        })
      } else if (!suppress) {
        console.warn('Controller.scopeStoreEvents called without a defined scope.')
      }
    }

    /**
     * @property {Object} store
     * Returns the #datastores associated with the controller.
     */
    get store () {
      return this.datastores
    }

    /**
     * @property {NGN.ref} ref
     * Returns a DOM reference.
     */
    get ref () {
      return NGN.ref
    }

    /**
     * @property {NGN.ref} dom
     * Returns a DOM reference. This is a shortcut to #ref.
     */
    get dom () {
      return this.ref
    }

    /**
     * @method on
     * Create an event handler
     * @param {string} eventName
     * Name of the event to handle.
     * @param {function} handler
     * The handler function that responds to the event.
     */
    on (topic, handler) {
      if (!NGN.BUS) {
        console.warn("NGNX.Controller.on('" + topic + "', ...) will not work because NGN.BUS is not available.")
        return
      }
      if (this.events.indexOf(topic) >= 0) {
        NGN.BUS.on(topic, handler)
      } else {
        console.warn(topic + ' is not a supported event for this Controller.')
      }
    }
  }
  NGNX.Controller = _Controller
}

'use strict'

/**
 * @inherits NGN.BUS
 * This user state management extension triggers events when the page
 * view changes (loading, navigates away, tab change, homescreen, etc).
 * It is a simple "semi-polyfill" that listens to the browser events
 * for desktop and mobile browsers, and responds in a standard way using
 * the NGN.BUS.
 * @fires state.change
 * Fired when the user state changes. Receives a payload of `visible`.
 * For example, to persist data when the user state changes:
 *
 * ```js
 * NGN.BUS.on('state.change', function (visible) {
 *   if (!visibile) {
 *     persistData()
 *   } else {
 *     restoreData()
 *   }
 * })
 * ```
 * @fires state.hidden
 * Fired when the state changes to "hidden". This means the
 * user switches tabs, apps, goes to homescreen, etc.
 * @fires state.visible
 * Fired when the state changes to "visible". This means the
 * user transitions from prerender, user returns to the app/tab, etc.
 */
if (!window.NGN.BUS) {
  console.warn('State management is inactive because NGN.BUS was not found.')
} else {
  window.NGNX = window.NGNX || {}
  NGN._od(NGNX, 'statechangerecorded', false, true, false, false)
  NGN.BUS.on('state.change', function (visible) {
    NGN.BUS.emit('state.' + (visible ? 'visible' : 'hidden'))
  })
  var statehandler = function () {
    if (!NGNX.statechangerecorded) {
      NGNX.statechangerecorded = true
      setTimeout(function () {
        NGNX.statechangerecorded = false
      }, 25)
      NGN.BUS.emit('state.change', document.visibilityState === 'visible')
    }
  }
  document.addEventListener('visibilitychange', statehandler)
  document.addEventListener('beforeunload', statehandler)
  document.addEventListener('pagehide', statehandler)
}

'use strict'

window.NGNX = window.NGNX || {}
window.NGNX.DATA = window.NGNX.DATA || {}

/**
 * @class NGNX.DATA.HttpProxy
 * Provides a gateway to a remote HTTP/S endpoint.
 * @extends NGN.DATA.Proxy
 */
if (NGN.DATA.Proxy && NGN.HTTP) {
  window.NGNX.DATA.HttpProxy = function (cfg) {
    cfg = cfg || {}

    this.constructor(cfg)
    var me = this

    Object.defineProperties(this, {
      /**
       * @cfg {object} headers
       * Provide custom HTTP headers that will be applied to every request.
       */
      headers: NGN.define(true, true, false, cfg.headers || {}),

      /**
       * @property options
       * The request option values.
       * @readonly
       * @private
       */
      options: NGN._get(function () {
        var req = {
          url: this.url,
          headers: this.headers
        }
        if (this.token) {
          req.accessToken = this.token
        }
        if (this.username) {
          req.username = this.username
        }
        if (this.password) {
          req.password = this.password
        }
        if (this.username && this.password) {
          req.withCredentials = true
        }
        return req
      }),

      /**
       * @method save
       * @param  {string} [path]
       * The path on which save operations should occur.
       * @param {function} [callback]
       * An optional callback to execute when the save is complete.
       * @fires save.error
       * Fired when a non-200/201 response code is received from the
       * remote server when trying to save data.
       */
      save: NGN.define(true, false, false, function (path, callback) {
        if (typeof url === 'function') {
          callback = path
          path = ''
        }

        var i = 0
        var increment = function (action, model) {
          return function (res) {
            i++
            if (!(res.status === 200 || res.status === 201)) {
              NGN.emit('save.error', {
                message: res.responseText,
                status: res.status,
                action: action,
                model: model
              })
            }
            if (i === (me.actions.create.length + me.actions.update.length + me.actions.delete.length)) {
              callback && callback()
            }
          }
        }

        var req = this.options
        req.url += (path || '')

        this.actions.create.forEach(function (model) {
          req.json = model.data
          NGN.HTTP.post(req, increment('create', model))
        })
        this.actions.update.forEach(function (model) {
          req.url += '/' + model.id
          req.json = model.data
          NGN.HTTP.put(req, increment('update', model))
        })
        this.actions.delete.forEach(function (model) {
          req.url += '/' + model.id
          NGN.HTTP.delete(req, increment('delete', model))
        })
      }),

      /**
       * @method fetch
       * Retrieve a JSON array-based data set from an API endpoint.
       * This method basically runs a `GET /path`, expecting an
       * array of data that can be loaded to the NGN.DATA.Model.
       * @param  {string} [path]
       * An optional path to add to the URL. This can Include
       * query strings.
       * @param {function} callback
       */
      fetch: NGN.define(true, false, false, function (path, callback) {
        var req = this.options
        req.url += (path || '')
        NGN.HTTP.get(req, function (res) {
          var data = res.responseText
          if (typeof data === 'string') {
            data = JSON.parse(data)
          }
          if (data instanceof Array) {
            me.store.reload(data)
          }
          callback && callback()
        })
      })
    })
  }
  NGN.DATA.util.inherit(NGN.DATA.Proxy, NGNX.DATA.HttpProxy)
} else {
  throw new Error('NGN.DATA.Proxy & NGN.HTTP are required for NGN.DATA.HttpProxy.')
}
