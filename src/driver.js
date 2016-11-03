'use strict'

if (!NGN) {
  console.error('NGN not found.')
} else {
  NGN.global.NGNX = NGN.global.NGNX || {}

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
  class Driver {
    constructor (cfg) {
      cfg = cfg || {}

      Object.defineProperties(this, {
        /**
         * @cfg {string} [namespace]
         * The namespace is prepended to NGN.BUS events. For example, setting
         * this to `mydriver.` will trigger events like
         * `mydriver.eventname` instead of just `eventname`.
         */
        scope: NGN.const(cfg.namespace || null),

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
         * let Driver = new NGNX.Driver({
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
         * References are _tecnically_ global, so they are accessible via
         * `NGN.ref`. However; practical use has proven there is little reason
         * to access a Driver reference globally. The NGNX.Driver adds a scope
         * (#id) to the reference name to prevent conflicts with other Drivers.
         * This is handled by the driver, providing a simpler syntax. As a
         * result, it is possible for each NGNX.Driver to have the same
         * reference names, where each reference refers to a differnt DOM
         * element. For example:
         *
         * ```js
         * let DriverA = new NGNX.Driver({
         *   references: {
         *   	 button: 'body > button' // <-- Difference
         *   }
         * })
         *
         * let DriverB = new NGNX.Driver({
         *   references: {
         *   	 button: 'div > button' // <-- Difference
         *   }
         * })
         *
         * console.log(DriverA.button) // Outputs the `body > button` DOM element
         * console.log(DriverB.button) // Outputs the `div > button` DOM element
         * ```
         *
         * `DriverA.button` and `DriverB.button` both have a `button` reference,
         * but each one refers to a different DOM element.
         */
        references: NGN.privateconst(cfg.references || {}),

        /**
         * @property {object} ref
         * Access a DOM #reference.
         * @readonly
         */
        ref: NGN.private({}),

        /**
         * @cfgproperty {Object} [stores]
         * An object of NGN.DATA.Store references to associate with the driver.
         *
         * ```js
         * let MyStore = new NGN.DATA.Store({
         *   model: MyModel,
         *   allowDuplicates: false
         * })
         *
         * let MyOtherStore = new NGN.DATA.Store({
         *   model: MyOtherModel,
         *   allowDuplicates: false
         * })
         *
         * let Driver = new NGNX.Driver({
         *   datastores: {
         *   	 a: MyStore,
         *   	 b: MyOtherStore
         *   }
         * })
         *
         * console.log(Driver.store.a.records) // dumps the records for MyModel
         * console.log(Driver.store.b.records) // dumps the records for MyOtherModel
         * ```
         * Setting store references will also trigger specially namespaced events,
         * making it simpler to pinpoint modifications to a specific store.
         * See #scopeStoreEvents for details.
         * @type {Object}
         */
        datastores: NGN.const(cfg.stores || {}),

        /**
         * @cfg {Object} templates
         * A named reference to NGN.NET templates. For example:
         *
         * ```js
         * let Driver = new NGNX.Driver({
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
         * NGN.NET.template('./views/templates/myview.html', data, function (el) {
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
        templates: NGN.private(cfg.templates || {}),

        /**
         * @property {Array} dataevents
         * The supported data events.
         * @hidden
         */
        dataevents: NGN.privateconst([
          'record.create',
          'record.delete',
          'record.duplicate',
          'record.update',
          'record.expired',
          'record.restored',
          'record.purged',
          'index.create',
          'index.delete',
          'filter.create',
          'filter.remove'
        ]),

        /**
         * @property {string} id
         * A key to uniquely identify the driver. This is an auto-generated
         * GUID, assigned in realtime.
         * @private
         */
        id: NGN.privateconst(NGN.coalesce(cfg.namespace, NGN.DATA.util.GUID()).replace(/[^A-Za-z0-9]/gi, ''))
      })

      // Generate references
      Object.keys(this.references).forEach((r) => {
        this.createReference(r, this.references[r])
      })

      // For each datastore, listen to the store's events and bubble the event.
      if (this.scope !== null) {
        Object.keys(this.datastores).forEach((name) => {
          this.scopeStoreEvents(name)
        })
      }
    }

    /**
     * @method createReference
     * Create a new reference associated with the Driver.
     * @param {string} name
     * Reference name.
     * @param {string} selector
     * The selector.
     * @private
     */
    createReference (name, selector) {
      if (!selector) {
        throw new Error('Invalid selector specified for new ' + name + ' reference.')
      }

      let originalName = name
      name = this.id + '-' + name

      if (NGN.ref[name] === undefined || NGN.ref[name] === null) {
        NGN.ref.create(name, selector)

        Object.defineProperty(this.ref, originalName, NGN.get(function () {
          return NGN.ref[name]
        }))
      }
    }

    /**
     * @alias addReference
     * Same as #createReference
     * @param {string} name
     * Reference name.
     * @param {string} selector
     * The selector.
     */
    addReference () {
      this.createReference.apply(this, arguments)
    }

    /**
     * @method addTemplate
     * A helper method to add a new template in realtime.
     * @param {string} name
     * The template name.
     * @param {string} source
     * The URL/fielpath where the template can be accessed.
     */
    addTemplate (name, source) {
      this.templates[name] = source
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
     * The key/value object passed to the NGN.NET.template method.
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
    render (name, data, parent, position, callback) {
      if (!this.templates.hasOwnProperty(name)) {
        console.warn('The Driver does not have a reference to a template called %c' + name.trim() + '%c.', NGN.css, '')
        return
      }

      if (typeof data !== 'object') {
        console.warn('The data provided to the renderer could not be processed because it is not a key/value object.', data)
        return
      }

      // If the parent is a function, treat it as a callback
      if (typeof parent === 'function') {
        NGN.NET.template(this.templates[name], data, parent)
        return
      }

      // If the parent is a selector, reference the element.
      if (typeof parent === 'string') {
        let p = parent

        parent = document.querySelector(parent)

        if (parent === null) {
          console.warn('%c' + p + '%c is not a valid selector or the referenced parent DOM element could not be found.', NGN.css, '')
          return
        }
      }

      position = (position || 'beforeend').toLowerCase()

      NGN.NET.template(this.templates[name], data, (element) => {
        if (NGN.hasOwnProperty('DOM')) {
          NGN.DOM.svg.update(element, () => {
            this.adjustedRender(parent, element, position, callback)
          })
        } else {
          this.adjustedRender(parent, element, position, callback)
        }
      })
    }

    adjustedRender (parent, element, position, callback) {
      if (['beforebegin', 'afterbegin', 'afterend'].indexOf(position.trim().toLowerCase()) < 0) {
        position = 'beforeend'
      }

      parent.insertAdjacentElement(position, element)

      switch (position) {
        case 'beforeend':
          this.templateRendered(element)
          break

        case 'beforebegin':
          this.templateRendered(parent.previousSibling)
          break

        case 'afterend':
          this.templateRendered(parent.nextSibling)
          break

        case 'afterbegin':
          this.templateRendered(parent.firstChild)
          break

        default:
          this.templateRendered(parent.lastChild)
      }

      if (callback) {
        callback(element)
      }
    }

    templateRendered (element) {
      NGN.BUS.emit(this.scope + 'template.render', element)
      NGN.BUS.emit('template.render', element)
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
      if (this.datastores.hasOwnProperty(name)) {
        if (this.scope !== null) {
          // Remove namespaced events.
          this.dataevents.forEach((e) => {
            NGN.BUS.off(this.scope + e)
          })
        }

        console.warn('Driver already had a reference to %c' + name + '%c, which has been overwritten.', NGN.css, '')
      }

      this.datastores[name] = store
      this.scopeStoreEvents(name)
    }

    /**
     * @method scopeStoreEvents
     * Apply the #namespace prefix to each datastore event. In addition to
     * prefixing with the namespace/scope, a separate event will be prefixed with both
     * the namespace and name of the store reference. This is a convenience event.
     *
     * For example:
     *
     * ```js
     * let MyStore = new NGN.DATA.Store({
     *   model: MyModel,
     *   allowDuplicates: false
     * })
     *
     * let MyOtherStore = new NGN.DATA.Store({
     *   model: MyOtherModel,
     *   allowDuplicates: false
     * })
     *
     * let Driver = new NGNX.Driver({
     *   namespace: 'myscope.', // <--- Notice the Driver scope!
     *   datastores: {
     *   	 a: MyStore, // <-- "a" is the store reference name for MyStore
     *   	 b: MyOtherStore // <-- "b" is the store reference name for MyOtherStore
     *   }
     * })
     *
     * // Listen for record creation on ALL stores the Driver references.
     * // In this case, adding a record to `MyStore` (a) or `MyOtherStore` (b)
     * // will both trigger this event handler.
     * NGN.BUS.on('myscope.record.create', function (record) {
     *   console.log(record.data)
     * })
     *
     * // Listen for record creation ONLY ON `MyStore`. Notice the event pattern:
     * // `{scope}.{storeReferenceName}.record.create`.
     * NGN.BUS.on('myscope.a.record.create', funciton (record) {
     *   console.log(record.data)
     * })
     * ```
     *
     * If you use an alternative delimiter/separator to define your events, the
     * Driver will recognize common ones, including a space, `-`, `.`, `_`, `+`,
     * ':', or `;`.
     * @param {String} name
     * The Driver reference name to the store.
     * @param {boolean} suppressWarning
     * Suppress the warning message if the namespace is not defined.
     * @private
     */
    scopeStoreEvents (name, suppress) {
      suppress = NGN.coalesce(suppress, false)

      const me = this

      if (this.scope !== null) {
        const sep = this.scope === null ? 'NONE' : this.scope.substr(this.scope.length - 1, 1)

        this.dataevents.forEach(function (e) {
          me.datastores[name].on(e, function () {
            let args = NGN.slice(arguments)

            if ([' ', '-', '.', '_', '+', ':'].indexOf(sep) >= 0) {
              args.unshift(me.scope + name + sep + e)
            } else {
              args.unshift(me.scope + name + e)
            }

            NGN.BUS.emit.apply(NGN.BUS, args)
          })
        })
      } else if (!suppress) {
        console.warn('Driver.scopeStoreEvents called without a defined namespace.')
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
     * @method on
     * Create an event handler
     * @param {string} eventName
     * Name of the event to handle.
     * @param {function} handler
     * The handler function that responds to the event.
     */
    on () {
      const topic = arguments[0]
      if (!NGN.BUS) {
        console.warn('%cNGNX.Driver.on(\'' + topic + '\', ...)%c will not work because NGN.BUS is not available.', NGN.css, '')
        return
      }

      arguments[0] = this.scope + arguments[0]
      NGN.BUS.on.apply(NGN.BUS, arguments)
    }

    /**
     * @method pool
     * A shortcut method to create an NGN.BUS.pool. This method will automatically
     * apply the #namespace prefix to the pool. It is possible to create multiple pools
     * by using an "extra" namespace.
     *
     * **Example**
     * ```js
     * let MyDriver = new NGNX.Driver({
     *   namespace: 'myprefix.'
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
     * If "extra" namespace isn't necessary, it will still apply the #namespace to events
     * in order to associate the events with this store.
     *
     * ```js
     * let MyDriver = new NGNX.Driver({
     *   namespace: 'myprefix.'
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
     * @param {string} [extranamespace]
     * An extra namespace to add to event listeners.
     * @param {object} handlers
     * An object containing event listeners. See NGN.BUS.pool for syntax and
     * examples.
     */
    pool (extra, data) {
      if (typeof extra === 'object') {
        data = extra
        extra = ''
      }

      let scope = (this.scope + extra).trim()

      scope = scope.length > 0 ? scope : null

      NGN.BUS.pool(scope, data)
    }

    /**
     * @method emit
     * This is a shortcut to NGN.BUS.emit, but it adds the #namespace to the event.
     *
     * **Example**:
     * ```js
     * let MyDriver = new NGNX.Driver({
     *   namespace: 'myprefix.'
     * })
     *
     * MyDriver.emit('some.event') // <--- Emit event
     * ```
     * The last line where the event is emitted will actually send an event
     * called `prefix.some.event` to the NGN BUS. In other words, the last line
     * is the equivalent of running:
     *
     * ```js
     * NGN.BUS.emit('prefix.some.event')
     * ```
     *
     * The "value-add" of this method is prepending the namespace automatically.
     * It also supports payloads (just like NGN.BUS.emit).
     * @param {string} eventName
     * The name of the event to trigger (with the #namespace prefixed to it).
     * @param {object|string|number|boolean|array} payload
     * An object to send to the event handler.
     */
    emit () {
      arguments[0] = this.scope + arguments[0]
      NGN.BUS.emit.apply(NGN.BUS, arguments)
    }
  }
  NGNX.Driver = Driver
}
