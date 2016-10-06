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
  }
  NGNX.Driver = _Driver
}
