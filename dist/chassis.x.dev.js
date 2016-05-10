/**
  * v1.0.14 generated on: Tue May 10 2016 10:45:20 GMT-0500 (CDT)
  * Copyright (c) 2014-2016, Ecor Ventures LLC. All Rights Reserved. See LICENSE (BSD).
  */
'use strict'

if (!NGN) {
  console.error('NGN not found.')
} else {
  window.NGNX = window.NGNX || {}

  /**
   * @class NGNX.Driver
   * Drivers can be used to easily reference & direct communication between
   * components of an application, such as data stores or DOM elements.
   *
   * NGN is based on the concept of a service bus (NGN.BUS), so the NGNX concept
   * of a driver differs from a tradtional MVC approach in subtle ways.
   * The biggest difference is a driver is designed to trigger events on the
   * global event bus. It also listens to the global event bus, responding
   * only to a selection of events it cares about.
   *
   * NGNX.Driver is designed to simplify event triggering and isolate
   * application logic in an opinionated way (keep it brutally simple). See the
   * options associated with each configuration property for specific details.
   *
   * This class was designed to be extended, acting primarily as a standard way
   * to trigger scoped events. It can be extended with any level of logic by adding
   * custom methods, properties, configurations, etc. For more details about
   * extending drivers, see the NGNX.Driver guide.
   */
  class _Driver {
    constructor (cfg) {
      cfg = cfg || {}

      Object.defineProperties(this, {
        /**
         * @cfg {string} [scope]
         * The scope is prepended to NGN.BUS events. For example, setting
         * this to `mydriver.` will trigger events like
         * `mydriver.eventname` instead of just `eventname`.
         */
        scope: NGN.define(true, false, false, cfg.scope || null),

        /**
         * @cfg {Object} [references]
         * An object of key/values depicting a reference. Each key is the
         * reference name, while each value is a DOM selector pattern. Providing
         * references here is the same as writing `NGN.ref.create('key',
         * 'selector/value')` for each reference (this is a shortcut method).
         * Additionally, these references are associated with the driver for
         * easy access.
         *
         * A reference can be accessed in one of two ways:
         *
         * 1. NGN.ref.key
         * 1. Driver.ref.key or Driver.dom.key
         *
         * ```js
         * var Driver = new NGNX.Driver({
         *   references: {
         *   	 buttons: 'body > button',
         *   	 nav: 'body > header > nav:first-of-type',
         *   	 input: '#myinput'
         *   }
         * })
         *
         * NGN.ref.buttons.forward('click', NGN.BUS.attach('some.event'))
         * // same as
         * Driver.ref.buttons.forward('click', NGN.BUS.attach('some.event'))
         * // same as
         * Driver.dom.buttons.forward('click', NGN.BUS.attach('some.event'))
         * // same as
         * Driver.dom.buttons.addEventListener('click', function (e) {
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
         * An object of NGN.DATA.Store references to associate with the driver.
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
         * var Driver = new NGNX.Driver({
         *   datastores: {
         *   	 a: MyStore,
         *   	 b: MyOtherStore
         *   }
         * })
         *
         * console.log(Driver.store.a.records) // dumps the records for MyModel
         * console.log(Driver.store.b.records) // dumps the records for MyOtherModel
         * ```
         * @type {Object}
         */
        datastores: NGN.define(true, false, false, cfg.stores || {}),

        /**
         * @property {Array} events
         * Contains a list of events that can be triggered by this driver.
         * @private
         */
        events: NGN.define(false, true, false, []),

        /**
         * @cfg {Object} templates
         * A named reference to NGN.HTTP templates. For example:
         *
         * ```js
         * var Driver = new NGNX.Driver({
         *   templates: {
         *     myview: './views/templates/myview.html',
         *     other: './views/templates/other.html'
         *   }
         * })
         *
         * // Apply the template to the DOM
         * Driver.render('myview', data, function (element) {
         *   document.appendChild(element)
         * })
         *
         * // Alternative way to apply the template to the DOM
         * Driver.render('myview', data, document)
         * Driver.render('myview', data, document, 'beforeEnd')
         * ```
         *
         * The last few lines of code are the equivalent of:
         *
         * ```js
         * NGN.HTTP.template('./views/templates/myview.html', data, function (el) {
         *   document.appendChild(el)
         * })
         * ```
         * The primary advantage is code simplicity/organization. It is possible
         * to define the same template in multiple Drivers, but they will always
         * reference the same template file because it is all handled by NGN.
         * This means all caching is handled automatically, regardless of which
         * Driver initiates the download. It also allows different drivers to
         * handle the response in a different manner.
         */
        templates: NGN.define(false, false, false, cfg.templates || {}),

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

      let me = this

      // Generate references
      Object.keys(this.references).forEach(function (r) {
        if (NGN.ref[r] === undefined || NGN.ref[r] === null) {
          NGN.ref.create(r, me.references[r])
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
     * @method render
     * Render a referenced template.
     *
     * **Examples:**
     * ```js
     * // Add the rendered template to the document at the end.
     * Driver.render('myview', data, document, 'beforeend')
     *
     * // Add the rendered template to the document at the end.
     * // Notice the 'beforeend' is missing (it is the default).
     * Driver.render('myview', data, document)
     *
     * // Mannually Apply the template to the DOM using a callback.
     * Driver.render('myview', data, function (element) {
     *   document.appendChild(element)
     * })
     * ```
     * @param {string} name
     * The name of the template provided in #templates.
     * @param {object} data
     * The key/value object passed to the NGN.HTTP.template method.
     * @param {HTMLElement|String} [parent]
     * The parent element or a selector reference to the parent element
     * in which the template code is injected.
     * @param {string} [position=beforeend]
     * If and only if a parent object is specified, this attribute will
     * insert the template at the specified position. Valid options are
     * anything passed to [insertAdjacentHTML](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML).
     * @param {function} [callback]
     * If no parent/position are provided, an optional callback can be used to
     * receive the DOM element generated by the template.
     * @param {HTMLElement} callback.element
     * The callback receives a valid HTML Element that can be modified or
     * inserted into the DOM.
     */
    render (name, data, parent, position) {
      if (!this.templates.hasOwnProperty(name)) {
        console.warn('The Driver does not have a reference to a template called \"' + name.trim() + '\".')
        return
      }
      if (typeof data !== 'object') {
        console.warn('The data provided to the renderer could not be processed because it is not a key/value object.', data)
        return
      }
      // If the parent is a function, treat it asa callback
      if (typeof parent === 'function') {
        NGN.HTTP.template(this.templates[name], parent)
        return
      }
      // If the parent is a selector, reference the element.
      if (typeof parent === 'string') {
        var p = parent
        parent = document.querySelector(parent)
        if (parent === null) {
          console.warn(p + ' is not a valid selector or the referenced parent DOM element could not be found.')
          return
        }
      }
      NGN.HTTP.template(this.templates[name], function (element) {
        if (['beforebegin', 'afterbegin', 'afterend'].indexOf(position.trim().toLowerCase()) < 0) {
          parent.appendChild(element)
        } else {
          parent.insertAdjacentHTML(position, element.outerHTML)
        }
      })
    }

    /**
     * @method addStore
     * Add a new datastore reference to the driver.
     *
     * **Example:**
     *
     * ```js
     * let MyStore = new NGN.DATA.Store({...})
     * let MyDriver = new NGNX.Driver({
     *   ...
     * })
     *
     * MyDriver.addStore('mystore', MyStore)
     *
     * console.log(MyDriver.store.mystore.records) // dumps the records
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
        console.warn('Driver already had a reference to ' + name + ', which has been overwritten.')
      }
      this.datastores[name] = store
      this.scopeStoreEvents(name)
    }

    /**
     * @method scopeStoreEvents
     * Apply the #scope prefix to each datastore event.
     * @param {String} name
     * The Driver reference name to the store.
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
        console.warn('Driver.scopeStoreEvents called without a defined scope.')
      }
    }

    /**
     * @property {Object} store
     * Returns the #datastores associated with the Driver.
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
        console.warn("NGNX.Driver.on('" + topic + "', ...) will not work because NGN.BUS is not available.")
        return
      }
      if (this.events.indexOf(topic) >= 0) {
        NGN.BUS.on(topic, handler)
      } else {
        console.warn(topic + ' is not a supported event for this Driver.')
      }
    }

    /**
     * @method pool
     * A shortcut method to create an NGN.BUS.pool. This method will automatically
     * apply the #scope prefix to the pool. It is possible to create multiple pools
     * by using an "extra" scope.
     *
     * **Example**
     * ```js
     * let MyDriver = new NGNX.Driver({
     *   scope: 'myprefix.'
     * })
     *
     * MyDriver.pool('extra.', {
     *   demo: function () {
     *     ...
     *   }
     * })
     *
     * // The above is equivalent to:
     *
     * NGN.BUS.pool('myprefix.extra.', {
     *   demo: function () { ... }
     * })
     * ```
     *
     * If "extra" scope isn't necessary, it will still apply the #scope to events
     * in order to associate the events with this store.
     *
     * ```js
     * let MyDriver = new NGNX.Driver({
     *   scope: 'myprefix.'
     * })
     *
     * MyDriver.pool({
     * 	 demo: function () {...}
     * })
     *
     * // The above is equivalent to:
     *
     * NGN.BUS.pool('myprefix.', {
     *   demo: function () { ... }
     * })
     * ```
     *
     * While this is a simple abstraction, it offers a code organization benefit.
     * Drivers can encapsulate BUS event logic in one place using a driver.
     * @param {string} [extrascope]
     * An extra scope to add to event listeners.
     * @param {object} handlers
     * An object containing event listeners. See NGN.BUS.pool for syntax and
     * examples.
     */
    pool (extra, data) {
      if (typeof extra === 'object') {
        data = extra
        extra = ''
      }
      var scope = (this.scope + extra).trim()
      scope = scope.length > 0 ? scope : null
      NGN.BUS.pool(scope, data)
    }
  }
  NGNX.Driver = _Driver
}

'use strict'

if (!NGN) {
  console.error('NGN not found.')
} else {
  if (!window.NGN.BUS) {
    console.warn('NGNX.Loader is not available because NGN.BUS was not found.')
  } else if (!NGN.HTTP) {
    console.warn('NGNX.Loader is not available because NGN.HTTP was not found.')
  } else {
    window.NGNX = window.NGNX || {}

    /**
     * @method NGNX.Loader
     * Load files a/synchronously and fire an event/callback when everything
     * is ready. Synchronous files are loaded first in a one-by-one manner.
     * Then asynchronous files are loaded in parallel at the same time. Once
     * **all** files are loaded, the callback or event is triggered.
     *
     * **Example Using Callback**
     * ```js
     * NGNX.Loader({
     *   sync: [
     *     './path/to/file1.js',
     *     './path/to/file2.js',
     *     './path/to/file3.js',
     *   ],
     *   async: [
     *     './path/to/file4.js',
     *     './path/to/file5.js',
     *     './path/to/file6.js',
     *   ],
     * }, function (loadedFiles) {
     *   // Do Something
     *   console.log(loadedFiles) // ['array', 'of', 'files']
     * })
     * ```
     * In this example, the series of actions is as follows:
     * 1. GET ./path/to/file1.js, then:
     * 1. GET ./path/to/file2.js, then:
     * 1. GET ./path/to/file3.js, then:
     * 1. GET ./path/to/file4.js & GET ./path/to/file5.js & GET ./path/to/file6.js, then:
     * 1. Do Something
     *
     * **Example Using Callback**
     * This does the same series of actions and provides the same functionality
     * as the callback example, except it uses the NGN.BUS to identify the end
     * of the load sequence.
     * ```js
     * NGNX.Loader({
     *   sync: [
     *     './path/to/file1.js',
     *     './path/to/file2.js',
     *     './path/to/file3.js',
     *   ],
     *   async: [
     *     './path/to/file4.js',
     *     './path/to/file5.js',
     *     './path/to/file6.js',
     *   ],
     * }, 'myfiles.loaded')
     *
     * NGN.BUS.once('myfiles.loaded', function (loadedFiles) {
     *   // Do Something
     *   console.log(loadedFiles) // ['array', 'of', 'files']
     * })
     * ```
     * The advantage of using the NGN.BUS method is the listener can exist in
     * a different file from the loader.
     * @param {object} cfg
     * @param {Function|string} callbackOrEvent
     * If a function is passed in, it will be run once all files are loaded. If
     * a event name is passed in, it will be triggered on the NGN.BUS once all
     * files are loaded. The callback receives a single array argument containing
     * all of the files loaded. This same argument is sent as a payload to the
     * event bus.
     */
    window.NGNX.Loader = function (cfg, callback) {
      cfg = cfg || {}

      var me = this
      Object.defineProperties(this, {
        /**
         * @cfg {Array|String} sync
         * The files that will be loaded one-by-one. They are loaded in the order
         * they are specified.
         */
        async: NGN.define(true, true, false, cfg.async || []),

        /**
         * @cfg {Array|String} async
         * The files that will be loaded asynchronously. They are all loaded at
         * the same time. Even though this is asynchronous, if a callback is
         * provided to the Loader, it will not be run until all of the files
         * are loaded. The point of this method is to reduce time-to-load (parallel
         * downloads).
         */
        sync: NGN.define(true, true, false, cfg.sync || [])
      })

      this.async = Array.isArray(this.async) ? this.async : [this.async]
      this.sync = Array.isArray(this.sync) ? this.sync : [this.sync]

      var meta = {
        sync: this.sync,
        async: this.async
      }

      // Synchronous file loader
      var loadSync = function (files) {
        NGN.HTTP.import(files.shift(), function () {
          if (files.length > 0) {
            loadSync(files)
          }
        })
      }

      // Load synchronous files first
      if (meta.sync.length > 0) {
        loadSync(meta.sync)
      }

      // Load asynchronous files
      if (this.async.length > 0) {
        NGN.HTTP.import(this.async, function (imported) {
          // Force a slight delay to assure everything is loaded.
          setTimeout(function () {
            if (typeof callback === 'function') {
              callback(me.sync.concat(imported))
            } else {
              NGN.BUS.emit(callback, me.sync.concat(me.async))
            }
          }, 5)
        })
      } else {
        if (typeof callback === 'function') {
          callback(this.sync.concat(this.async))
        } else {
          NGN.BUS.emit(callback, this.sync.concat(this.async))
        }
      }
    }
  }
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
