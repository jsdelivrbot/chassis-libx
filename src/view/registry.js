if (!NGN) {
  console.error('NGN not found.')
} else {
  window.NGNX = window.NGNX || {}

  /**
   * @class NGNX.VIEW.Registry
   * A view registry is an organizational collection/grouping of events and
   * references that form the basis of a visual component. It is used to
   * break large applications into structured components that make sense to a
   * human being.
   *
   * NGN provides a global event bus and global references to DOM elements,
   * which are easy to understand when there are only a few. However; the
   * sheer volume of events and references in a larger application can make
   * the code base difficult to understand. View Registries provide a way to
   * group events/references in a logical and organized way.
   *
   * View Registries inherit the functionality of the NGX.Driver, which
   * automatically applies the #namespace to event names. This is an important
   * concept in understanding how event names are constructed/managed.
   *
   * **Example:**
   *
   * ```js
   * let myReg = new NGNX.VIEW.Registry({
   *   namespace: 'mycomponent.',
   *   selector: 'body main .mycomponent'
   * })
   *
   * myReg.forward('some.event', 'another.event')
   *
   * // Generic event handler
   * NGN.BUS.on('another.event', function (data) {
   *   console.log(data)
   * })
   *
   * // Fire an event
   * NGN.BUS.emit('mycomponent.some.event', data) // This is equivalent to the line below.
   * myReg.emit('some.event', data) // This is the equivalent of the line above.
   * ```
   *
   * In this example, the NGN.BUS fires an event recognized by the view registry,
   * called `mycomponent.some.event`. This is forwarded to a generic event called
   * `another.event`, which gets logged to the console.
   *
   * The view registry automatically applies the namespace, called `mycomponent.`,
   * to each event it triggers/handles. This is why `myReg.emit('some.event', data)`
   * actually fires `mycomponent.some.event`. This is also why the `myReg.forward()`
   * is passed `some.event` instead of `mycomponent.some.event`.
   * @extends NGNX.Driver
   * @fires property.changed
   * Fired when a property has changed. Event handlers will receive an object argument
   * that looks like:
   * ```js
   * {
   *   property: 'property name',
   *   old: 'old value',
   *   new: 'new value'
   * }
   * ```
   * @fires property.[field].changed
   * Fired when a specific property has changed. Event handlers will receive an
   * object argument that looks like:
   * ```js
   * {
   *   old: 'old value',
   *   new: 'new value'
   * }
   * ```
   *
   * For example, if a property called `title` exists, the
   * event would be `property.title.changed`.
   * @fires state.changed
   * Triggered when the state of the registry has changed.
   * @fires state.preprocess
   * Triggered when a #preStates process is executed. The name of
   * the preState is provided as the only parameter to event handlers.
   * @fires state.postprocess
   * Triggered when a #postStates process is executed. The name of
   * the postState is provided as the only parameter to event handlers.
   * @fires parent.state.changed
   * Triggered when the state of the parent registry has changed.
   * @fires element.removed
   * Triggered when the element (#selector) is removed from the DOM.
   * The old element is sent as the only argument to event handlers.
   * @fires monitoring.enabled
   * Triggered when DOM element monitoring becomes active.
   * @fires monitoring.disabled
   * Triggered when DOM element monitoring becomes inactive.
   */
  class NgnViewRegistry extends NGNX.Driver {
    constructor (cfg) {
      cfg = cfg || {}

      // Require an object for the configuration
      if (typeof cfg !== 'object') {
        throw new Error(`Invalid configuration. Expected Object, received ${typeof cfg}.`)
      }

      // cfg.selector = NGN.coalesce(cfg.selector, cfg.element)

      // Make sure the selector has been defined.
      if (!cfg.hasOwnProperty('selector')) {
        throw new Error('Missing required configuration attribute: selector')
      } else if (typeof cfg.selector !== 'string') {
        throw new Error('Invalid selector configuration.')
      }

      // cfg.selector = typeof cfg.selector === 'string' ? cfg.selector : NGN.DOM.selectorOfElement(cfg.selector)

      // Inherit from parent
      if (cfg.hasOwnProperty('parent')) {
        if (document.querySelector(cfg.parent.selector) === null) {
          throw new Error('Parent component could not be found.')
        } else {
          cfg.selector = cfg.parent.selector + ' ' + cfg.selector
        }

        // Prepend namespace
        if (cfg.hasOwnProperty('namespace')) {
          if (cfg.parent.scope !== null) {
            cfg.namespace = cfg.parent.scope + cfg.namespace
          }
        } else if (cfg.parent.scope) {
          cfg.namespace = cfg.parent.scope
        }
      }

      // If there are references, scope them according to the selector.
      if (cfg.hasOwnProperty('references')) {
        // let refMap = cfg.references
        const flattenReferences = function (cfg, namespace = '', additionalReferences) {
          let refs = NGN.coalesce(additionalReferences, {})

          Object.keys(cfg).forEach((key) => {
            let capitalizedKey = `${key.substr(0, 1).toUpperCase()}${key.substr(1, key.length)}`
            let ns = namespace !== '' ? `${namespace}${capitalizedKey}` : key

            if (typeof cfg[key] === 'object') {
              flattenReferences(cfg[key], ns, refs)
            } else if (typeof cfg[key] === 'string') {
              refs[ns] = cfg[key]
            }
          })

          return refs
        }

        cfg.references = flattenReferences(cfg.references)

        Object.keys(cfg.references).forEach((r) => {
          cfg.references[r] = `${cfg.selector} ${cfg.references[r]}`
        })
      }

      let element = document.querySelector(cfg.selector)

      if (element === null) {
        throw new Error(`Could not find valid DOM element for '${cfg.selector}'`)
      }

      // Initialize the NGNX.Driver
      super(cfg)

      /**
       * @cfg {NGNX.VIEW.Registry} [parent]
       * The parent View Registry. This optional configuration is commonly used
       * to break large registries into smaller/more managable registries.
       */
      Object.defineProperties(this, {
        /**
         * @cfg {string} element (required)
         * The element or CSS selector string of the DOM element to manage.
         * This is used as the "root" of all NGN references & events.
         */
        selector: NGN.const(cfg.selector),

        _element: NGN.private(element),

        /**
         * @cfg {NGNX.VIEW.Registry} parent
         * A parent registry. This identifies the view registry
         * as a child of another.
         */
        _parent: NGN.privateconst(NGN.coalesce(cfg.parent)),

        /**
         * @cfg {Object} properties
         * Specify the properties of the registry. Properties
         */
        propertyFields: NGN.private(NGN.coalesce(cfg.properties)),

        _properties: NGN.private(null),

        /**
         * @cfg {Object} [states]
         * Define what happens in each state. This is a key/value object
         * where the key represents the name/identifier of the state (string)
         * and the value is a function. The function receives a single argument,
         * the state change object. This object contains the old and new state.
         *
         * **Example**
         *
         * ```js
         * let Registry = new NGNX.VIEW.Registry({
         *   namespace: 'myscope.',
         *   selector: '.path .to element',
         *   references: {
         *     connectionIndicator: '#indicator',
         *     description: 'body > .description'
         *   },
         *   properties: {
         *     online: Boolean,
         *     description: {
         *       type: String,
         *       default: 'No description available.'
         *     }
         *   },
         *   states: {
         *     default: (stateChange) => {
         *       this.properties.description = 'Unknown'
         *     },
         *
         *     offline: (stateChange) => {
         *       if (stateChange.old !== 'offline') {
         *         this.properties.description = 'No connection established.'
         *       }
         *
         *       this.ref.connectionIndicator.classList.remove('online')
         *     },
         *
         *     online: (stateChange) => {
         *       if (stateChange.new === 'online') {
         *         this.properties.description = 'Connection established to remote server.'
         *       }
         *
         *       this.ref.connectionIndicator.classList.add('online')
         *     }
         *   },
         *   initialState: 'offline'
         * })
         *
         * Registry.on('property.change', (change) => {
         *   if (change.property === 'description') {
         *     this.ref.description.innerHTML = change.new
         *   }
         * })
         *
         * // Change the state to "online"
         * Registry.state = 'online'
         *
         * console.log(Registry.state) // Outputs "online"
         *
         * // Change the state back to "offline" after 3 seconds
         * setTimeout(() => {
         *   Registry.state = 'offline'
         * }, 3000)
         * ```
         */
        _states: NGN.private(NGN.coalesce(cfg.states, {})),

        _state: NGN.private('default'),

        /**
         * @cfg {object} preStates
         * This option provides pre-hook style operations that run before a
         * state change occurs. For example:
         *
         * ```js
         * let myRegistry = new NGNX.VIEW.Registry({
         *   selector: '#portal',
         *   properties: {
         *     authorized: {
         *       type: Boolean,
         *       default: false
         *     }
         *   },
         *   states: {
         *     login: function () {...},
         *     privatehomescreen: function () {...},
         *     anotherprivatescreen: function () {...}
         *   },
         *
         *   prestates: {
         *     '*': function (currentState, proposedState) {
         *       console.log(`Switching from ${currentState} to ${proposedState}!`)
         *     },
         *
         *     privatehomescreen: function () {
         *       if (!this.properties.authorized) {
         *         return false
         *       }
         *     },
         *
         *     anotherprivatescreen: function (currentState, proposedState, next) {
         *       myAsyncOperation(function (err, response) {
         *         console.log(response)
         *         next()
         *       })
         *     }
         *   }
         * })
         * ```
         *
         * In the example above, the `'*'` "prestate" is a catch-all that operates
         * **before** _every state change_ and **before** _every other prestate_.
         * For every state change, it will log a message
         * to the console stating "Switching from ____ to ____!"
         *
         * The `privatehomescreen` prestate synchronously checks the registry
         * properties to see if the user is authorized to do so. If not, it returns
         * `false`, which will prevent the state change from happening.
         *
         * The `anotherprivatescreen` prestate runs an asynchronous function, such
         * as an HTTP/AJAX request before proceeding to change the state.
         */
        _prestates: NGN.private(NGN.coalesce(cfg.prestates, cfg.preStates, null)),

        /**
         * @cfg {object} postStates
         * This option provides post-hook style operations that run after a
         * state change occurs. For example:
         *
         * ```js
         * let myRegistry = new NGNX.VIEW.Registry({
         *   selector: '#portal',
         *   properties: {
         *     authorized: {
         *       type: Boolean,
         *       default: false
         *     }
         *   },
         *   states: {
         *     login: function () {...},
         *     privatehomescreen: function () {...},
         *     anotherprivatescreen: function () {...}
         *   },
         *
         *   postStates: {
         *     '*': function () {
         *       console.log(`Switced from ${this.previousState} to ${this.state}!`)
         *     },
         *
         *     login: function () {
         *       console.log('User needs to login again.')
         *     }
         *   }
         * })
         * ```
         *
         * In the example above, the `'*'` "poststate" is a catch-all that operates
         * **after** _every state change_, but **before** _every other poststate_.
         * Every time a state change occurs, it will
         * log "Switched from ____ to ____!". Notice no parameters are passed to
         * the functions, because all state changes are known after they complete.
         *
         * In this example, changing to the `login` state would log a message
         * indicating the user needs to login again.
         */
        _poststates: NGN.private(NGN.coalesce(cfg.poststates, cfg.postStates, null)),

        displaystate: NGN.private(null),

        _previousstate: NGN.private(null),

        /**
         * @cfg {string} [initialState=default]
         * Specify the initial state of the registry.
         */
        initialstate: NGN.private(NGN.coalesce(cfg.initialState, cfg.initialstate, 'default')),

        /**
         * @cfg {Object} [reactions]
         * Map #parent states to the registry #states. This can be used to
         * automatically cascade state changes throughout a view.
         *
         * **Example**
         *
         * ```js
         * let Registry = new NGNX.VIEW.Registry({
         *   parent: MyParentView Registry,
         *   namespace: 'myscope.',
         *   selector: '.path .to element',
         *   references: {
         *     connectionIndicator: '#indicator',
         *     description: 'body > .description'
         *   },
         *   properties: {
         *     online: Boolean,
         *     description: {
         *       type: String,
         *       default: 'No description available.'
         *     }
         *   },
         *   states: {
         *     default: (stateChange) => {
         *       this.properties.description = 'Unknown'
         *     },
         *
         *     offline: (stateChange) => {
         *       if (stateChange.old !== 'offline') {
         *         this.properties.description = 'No connection established.'
         *       }
         *
         *       this.ref.connectionIndicator.classList.remove('online')
         *     },
         *
         *     online: (stateChange) => {
         *       if (stateChange.new === 'online') {
         *         this.properties.description = 'Connection established to remote server.'
         *       }
         *
         *       this.ref.connectionIndicator.classList.add('online')
         *     }
         *   },
         *   initialState: 'offline',
         *   reactions: {
         *     connected: 'online',
         *     disconnected: 'offline'
         *   }
         * })
         *
         * MyParentView Registry.state = 'connected'
         *
         * console.log(Registry.state) // Outputs "online"
         * ```
         *
         * In this example, setting the #parent state to `connected`
         * is detected by `Registry`, which reacts by setting its own
         * state to `online`.
         */
        _reactions: NGN.private(NGN.coalesce(cfg.reactions)),

        /**
         * @cfg {Object|Array} reflexes
         * Map arbitrary states (from a non-parent registry) to the
         * registry #states. Multiple reflexes can be applied simultaneously by
         * passing an array instead of a single object.
         *
         * Reflexes are a special kind of reaction. A _reaction_ responds
         * to state changes in the #parent, whereas a _reflex_ responds to
         * state changes in an arbitrary view registries.
         *
         * **Example**
         *
         * ```js
         * let Registry = new NGNX.VIEW.Registry({
         *   parent: MyParentView Registry,
         *   namespace: 'myscope.',
         *   selector: '.path .to element',
         *   references: {
         *     connectionIndicator: '#indicator',
         *     description: 'body > .description'
         *   },
         *   properties: {
         *     online: Boolean,
         *     description: {
         *       type: String,
         *       default: 'No description available.'
         *     }
         *   },
         *   states: {
         *     default: (stateChange) => {
         *       this.properties.description = 'Unknown'
         *     },
         *
         *     offline: (stateChange) => {
         *       if (stateChange.old !== 'offline') {
         *         this.properties.description = 'No connection established.'
         *       }
         *
         *       this.ref.connectionIndicator.classList.remove('online')
         *     },
         *
         *     online: (stateChange) => {
         *       if (stateChange.new === 'online') {
         *         this.properties.description = 'Connection established to remote server.'
         *       }
         *
         *       this.ref.connectionIndicator.classList.add('online')
         *     }
         *   },
         *   initialState: 'offline',
         *   reactions: {
         *     connected: 'online',
         *     disconnected: 'offline'
         *   },
         *   reflexes: {
         *     registry: someOtherRegistry,
         *     reactions: {
         *       pause: 'offline',
         *       play: 'online'
         *     }
         *   }
         * })
         *
         * someOtherRegistry.state = 'pause'
         *
         * console.log(Registry.state) // Outputs "offline"
         * ```
         */
        _reflexes: NGN.private(NGN.coalesce(cfg.reflexes, [])),

        /**
         * @cfg {function} init
         * Initialize the view registry by running this method before
         * the initial state is set. This is useful for applying event
         * listeners to DOM elements, performing operations before
         * modifying visual layouts, or handling data before any other
         * operations are performed.
         *
         * The init method will receive a single argument that can be used
         * to asynchronously trigger the `initialized` event.
         *
         * ```js
         * let MyReg = new NGNX.VIEW.Registry({
         *   selector: '.selector .path',
         *   namespace: 'test.',
         *   init: function (next) {
         *     someAjaxCall(function (response) {
         *       ... do something with response ...
         *       next()
         *     })
         *   }
         * })
         * ```
         */
        _init: NGN.privateconst(NGN.coalesce(cfg.init)),

        _activeViewportState: NGN.private(null),

        /**
         * @cfg {Boolean} [monitor=false]
         * Set this to `true` to trigger events when the element (#selector)
         * is removed from the DOM.
         */
        monitoring: NGN.private(false),
        _monitor: NGN.private(null) // Placeholder for mutation observer

        // refMap: NGN.privateconst(NGN.coalesce(refMap, null))
      })

      // Assure a default state method exists
      if (!this._states.hasOwnProperty('default')) {
        this._states['default'] = function () {} // No-op default
      }

      // If reflexes exist as an object, convert to an array
      if (!Array.isArray(this._reflexes)) {
        this._reflexes = [this._reflexes]
      }

      // Create a self reference by Driver ID (inherited)
      NGNX.REF.create(this.id, this.selector)

      // Initialize the properties store
      if (this.propertyFields !== null) {
        this._properties = (new NGN.DATA.Model({
          fields: this.propertyFields
        })())

        this.on('property.changed', (change) => {
          this.emit(`property.${change.property}.changed`, {
            old: change.old,
            new: change.new
          })
        })

        this._properties.on('field.update', (change) => {
          if (change.old !== change.new) {
            this.emit('property.changed', {
              property: change.field,
              old: change.old,
              new: change.new
            })
          }
        })

        this._properties.on('field.create', (change) => {
          this.emit('property.changed', {
            property: change.field,
            old: null,
            new: NGN.coalesce(this._properties[change.field])
          })
        })

        this._properties.on('field.delete', (change) => {
          this.emit('property.changed', {
            property: change.field,
            old: change.value,
            new: null
          })
        })
      }

      // Watch the parent, if it exists.
      if (this._parent) {
        // If a parent exists, bubble state & property events down the chain.
        this._parent.on('state.changed', (state) => {
          this.emit('parent.state.changed', state)
        })

        this._parent.on('property.changed', (change) => {
          this.emit('parent.property.changed', change)
        })
      }

      // React to changes in the parent view.
      this.on('parent.state.changed', (state) => {
        if (this.managesReaction(state.new)) {
          this.state = this.reactions[state.new]
        }
      })

      // Initialize Reflex Handlers
      this._reflexes.forEach((reflex) => {
        reflex.registry.on('state.changed', this.reflexHandler(reflex.registry))
      })

      // Apply scope warnings to all state handlers
      for (let scope in this._states) {
        let handlerFn = this._states[scope]
        this._states[scope] = (change) => {
          try {
            handlerFn.apply(this, arguments)
          } catch (e) {
            let fnString = handlerFn.toString().toLowerCase()
            if (fnString.indexOf('this.') >= 0 && fnString.indexOf('function') < 0) {
              console.warn(`The %c${scope}%c state handler on line ${NGN.stack.pop().line} references the lexical %cthis%c scope, which may be the cause of the error if the handler is defined as a fat arrow function. This can be resolved by using a real function instead of a fat arrow function.`, NGN.css, 'font-weight: 100;', NGN.css, 'font-weight: 100;')
            }

            throw e
          }
        }
      }

      // Optional Initialization
      if (this._init) {
        if (this._init.length === 1) {
          // Async
          this._init(() => NGNX.util.requeue(() => this.emit('initialized')))
        } else {
          this._init()
          NGNX.util.requeue(() => this.emit('initialized'))
        }
      } else {
        NGNX.util.requeue(() => this.emit('initialized'))
      }

      // Set the initial state.
      if (this.initialstate !== this._state && this.managesState(this.initialstate)) {
        NGNX.util.requeue(() => {
          this._state = this.initialstate
          this._states[this._state]()
        })
      } else if (this._state === 'default') {
        this._states.default()
      }

      if (this.monitoring) {
        this.enableElementMonitor()
      }
    }

    /**
     * @property {NGNX.VIEW.Registry} parent
     * Returns the parent registry or `null` if there is no parent.
     */
    get parent () {
      return NGN.coalesce(this._parent)
    }

    /**
     * @property {NGNX.REF} element
     * The NGN reference to the DOM #selector DOM element.
     * @readonly
     */
    get self () {
      return NGNX.REF[this.id]
    }

    /**
     * @property {Object} reactions
     * Retrieve the reactions defined in the configuration.
     * @readonly
     */
    get reactions () {
      return NGN.coalesce(this._reactions, {})
    }

    /**
     * @property {Array} reflexes
     * Retrieve the reflexes defined in the configuration.
     * @readonly
     */
    get reflexes () {
      return NGN.coalesce(this._reflexes, [])
    }

    /**
     * @property {String} previousState
     * The most recent prior state of the view registry.
     * @readonly
     */
    get previousState () {
      return NGN.coalesce(this._previousstate, 'default')
    }

    /**
     * @property {String} state
     * The current state of the view registry.
     */
    get state () {
      return NGN.coalesce(this._state, 'default')
    }

    /**
     * @event state.changed
     * Fired when the state changes. Handlers of this event will be
     * provided an object containing the old and new state:
     *
     * ```js
     * {
     *   old: 'old_state',
     *   new: 'new_state'
     * }
     * ```
     */
    set state (value) {
      value = NGN.coalesce(value, this.initialstate, 'default')

      // If there is no change, don't update the state.
      if (this.state === value) {
        return
      }

      // If the state isn't recognized, throw an error.
      if (!this.managesState(value)) {
        console.warn(`Could not change from%c ${this.state}%c to %c${value}%c state.%c ${value}%c is not a valid state.`, NGN.css, 'font-weight: normal;', NGN.css, 'font-weight: normal;', NGN.css, 'font-weight: normal;')

        console.groupCollapsed('Valid States')
        Object.keys(this._states).forEach((state) => console.log(state))
        console.groupEnd()

        throw new Error(value + ' is not state managed by the View Registry.')
      }

      let updated = false

      const updateState = () => {
        if (updated) {
          return
        }

        updated = true

        this._previousstate = this.state
        this._state = value.toString().trim()

        let change = {
          old: this._previousstate,
          new: this._state
        }

        // Apply state changes
        this._states[this._state](change)
        this.emit('state.changed', change)

        change = null

        // Support global post-state-change hook
        if (this.managesPostState('*')) {
          this._poststates['*']()
          this.emit('state.postprocess', '*')
        }

        // Support specific post-state-change hook
        if (this.managesPostState(value)) {
          this._poststates[value]()
          this.emit('state.postprocess', value)
        }
      }

      // If there are no pre-state handlers, just update the state
      // without setting up a taskrunner.
      if (!this.managesPreState('*') && !this.managesPreState(value)) {
        updateState()
      }

      // Change state as a series of tasks
      let tasks = new NGN.Tasks()

      // Run the global pre-state-change hook first, if it is present.
      if (this.managesPreState('*')) {
        tasks.add('Execute global prestate (*).', (next) => {
          let continueProcessing = NGN.coalesce(this._prestates['*'].apply(this, [this.state, value, () => {
            this.emit('state.preprocess', '*')
            next()
          }]), true)

          // Support synchronous execution when applicable
          if (this._prestates['*'].length !== 3) {
            if (continueProcessing) {
              this.emit('state.preprocess', '*')
              next()
            } else {
              tasks.abort()
            }
          }
        })
      }

      // Run the state change if it is present.
      if (this.managesPreState(value)) {
        tasks.add(`Execute specific ${value} prestate.`, (next) => {
          let continueProcessing = NGN.coalesce(this._prestates[value].apply(this, [this.state, value, () => {
            this.emit('state.preprocess', value)
            next()
          }]), true)

          // Support synchronous execution when applicable
          if (this._prestates[value].length !== 3) {
            if (continueProcessing) {
              this.emit('state.preprocess', value)
              next()
            } else {
              tasks.abort()
            }
          }
        })
      }

      // Run the update if the process isn't aborted by this point.
      tasks.add(`Set to ${value} state.`, updateState)

      tasks.run(true) // Run tasks sequentially to assure order
    }

    /**
     * @property {Array} states
     * A list of states managed by the view registry.
     * @readonly
     */
    get states () {
      return Object.keys(this._states)
    }

    /**
     * @property {Array} preStates
     * A list of pre-state-change hooks managed by the view registry.
     * @readonly
     */
    get preStates () {
      if (!this._prestates) {
        return []
      }
      return Object.keys(this._prestates)
    }

    /**
     * @property {Array} postStates
     * A list of post-state-change hooks managed by the view registry.
     * @readonly
     */
    get postStates () {
      if (!this._poststates) {
        return []
      }
      return Object.keys(this._poststates)
    }

    /**
     * @property {NGN.DATA.Model} properties
     * A reference to the properties of the registry.
     * @readonly
     */
    get properties () {
      if (this._properties === null) {
        console.warn('Registry properties were requested, but none are configured.')
        return {}
      }

      return this._properties
    }

    /**
     * @property {boolean} inViewport
     * Determines whether the registry element (#selector) is in the viewport or not.
     */
    get inViewport () {
      return this.elementInViewport(this.self)
    }

    /**
     * @method isElementInViewport
     * Determines whether a DOM element is in the viewport or not.
     * @param {HTMLElement} element
     * The DOM element to check.
     * @returns {boolean}
     * @private
     */
    elementInViewport (element) {
      let rect = element.getBoundingClientRect()
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      )
    }

    /**
     * @method enableScrollMonitor
     * Enables scroll monitoring associated with the #selector element.
     * This method enables `enterViewport` and `exitViewport` events.
     */
    enableScrollMonitor () {
      this._activeViewportState = NGN.coalesce(this._activeViewportState, this.inViewport)
      window.addEventListener('scroll', (scrollEvent) => this.handleScrollEvent(scrollEvent))
    }

    /**
     * @method disableScrollMonitor
     * Disables scroll monitoring associated with the #selector element.
     * This method prevents `enterViewport` and `exitViewport` events from firing.
     */
    disableScrollMonitor () {
      this._activeViewportState = null
      window.removeEventListener('scroll', (scrollEvent) => this.handleScrollEvent(scrollEvent))
    }

    /**
     * @method handleScrollEvent
     * Responsible for determining when a DOM element is in the viewport
     * and emitting an event when it changes (enter/exit viewport).
     * @param {Event} scrollevent
     * The scroll event.
     * @private
     */
    handleScrollEvent (e) {
      let inView = this.inViewport

      if (this._activeViewportState !== inView) {
        this.emit(inView ? 'enterViewport' : 'exitViewport', this.self)
      }
    }

    /**
     * @method enableElementMonitor
     * Enables element monitoring. This is the same as setting #monitor to `true`.
     * @private
     */
    enableElementMonitor () {
      this._monitor = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          // Make sure the element still exists (otherwise it was deleted permanently)
          if (this._element) {
            if (mutation.type === 'childList') {
              setTimeout(() => {
                for (let node = 0; node < mutation.addedNodes.length; node++) {
                  if (mutation.removedNodes[node] === this._element) {
                    this.emit('element.removed', mutation.removedNodes[node])
                    this.disableElementMonitor()
                    break
                  }
                }
              }, 0)
            }
          }
        })
      })

      this._monitor.observe(this._element.parentNode, {
        childList: true
      })

      this.monitoring = true

      this.emit('monitoring.enabled')
    }

    /**
     * @method disableElementMonitor
     * Disables element monitoring. This is the same as setting #monitor to `false`.
     * @private
     */
    disableElementMonitor () {
      this.monitoring = false

      if (this._monitor) {
        this._monitor.disconnect()
        this._monitor = null
        this.emit('monitoring.disabled')
      }
    }

    /**
     * @method managesState
     * Indicates the view registry manages a specific state.
     * @param {string} state
     * The name of the state to check for.
     * returns {boolean}
     * @private
     */
    managesState (state) {
      return this._states.hasOwnProperty(state) && NGN.isFn(this._states[state])
    }

    /**
     * @method managesPreState
     * Indicates the view registry manages a specific pre-state-change hook.
     * @param {string} state
     * The name of the state to check for.
     * returns {boolean}
     * @private
     */
    managesPreState (state) {
      if (!this._prestates) {
        return false
      }

      return this._prestates.hasOwnProperty(state) && NGN.isFn(this._prestates[state])
    }

    /**
     * @method managesPostState
     * Indicates the view registry manages a specific post-state-change hook.
     * @param {string} state
     * The name of the state to check for.
     * returns {boolean}
     * @private
     */
    managesPostState (state) {
      if (!this._poststates) {
        return false
      }

      return this._poststates.hasOwnProperty(state) && NGN.isFn(this._poststates[state])
    }

    /**
     * @method clearPreStates
     * Remove all pre-state-change hooks.
     */
    clearPreStates () {
      this._prestates = null
    }

    /**
     * @method clearPostStates
     * Remove all post-state-change hooks.
     */
    clearPostStates () {
      this._poststates = null
    }

    /**
     * @method managesReaction
     * Indicates the view registry manages a specific parent-child reaction.
     * @param {string} parentState
     * The name of the parent state to check for.
     * returns {boolean}
     * @private
     */
    managesReaction (state) {
      return this.reactions.hasOwnProperty(state)
    }

    /**
     * @method createReaction
     * Add a new #reaction mapping dynamically.
     * @param {string} parentState
     * The parent state to react to.
     * @param {string} reactionState
     * The state to set when the parentState is recognized.
     */
    createReaction (source, target) {
      if (!this._parent) {
        console.warn('Cannot create a reaction to a parent view registry when no parent is configured.')
        return
      }

      this._reactions[source] = target
    }

    /**
     * @method removeReaction
     * Remove a #reaction mapping dynamically.
     * @param {string} parentState
     * The parent state.
     */
    removeReaction (source) {
      if (this.reactions.hasOwnProperty(source)) {
        delete this._reactions[source]
      }
    }

    /**
     * @method clearReactions
     * Remove all reactions.
     */
    clearReactions () {
      this._reactions = null
    }

    /**
     * @method managesReflex
     * Indicates the view registry manages a specific registry-registry reaction (reflex).
     * @param {NGNX.VIEW.Registry} registry
     * The registry whose state changes are observed.
     * @param {string} state
     * The registry state the reflex is responding to.
     * returns {boolean}
     * @private
     */
    managesReflex (registry, state) {
      let reactions = this.getRegistryReflexReactions(registry)

      return Object.keys(reactions).contains(state)
    }

    /**
     * @class getRegistryReflex
     * Returns a specific reflex.
     * @param {NGNX.VIEW.Registry} registry
     * The registry to retrieve.
     * @returns {Object}
     * Returns a key/value object mimicking #reactions.
     * @private
     */
    getRegistryReflex (registry) {
      let reflexes = this.reflexes.filter((reflex) => {
        return reflex.registry === registry
      })

      return reflexes.length === 1 ? reflexes[0] : {}
    }

    /**
     * @class getRegistryReflexReactions
     * Returns a specific reflex for the specified registry.
     * @param {NGNX.VIEW.Registry} registry
     * The registry whose reactions are being requested.
     * @returns {Object}
     * Returns a key/value object mimicking #reactions.
     * @private
     */
    getRegistryReflexReactions (registry) {
      let reflexes = this.getRegistryReflex(registry)

      return reflexes.length === 0 ? {} : reflexes.reactions
    }

    /**
     * @method getRegistryReflexIndex
     * Returns the index of the registry reflex within the #reflexes array.
     * @param NGNX.VIEW.Registry} registry
     * The registry whose reactions are being requested.
     * @returns {Nubmer}
     * @private
     */
    getRegistryReflexIndex (registry) {
      let index = -1

      this.getRegistryReflex(registry).filter((reflex, i) => {
        if (reflex.registry === registry) {
          index = i
          return true
        }

        return false
      })

      return index
    }

    /**
     * @method createReflex
     * Add a new #reflexes mapping dynamically.
     * @param {NGNX.VIEW.Registry} registry
     * The registry to monitor for state changes.
     * @param {string} sourceState
     * The registry state to listen for.
     * @param {string} reactionState
     * The state to set when the sourceState is recognized.
     */
    createReflex (registry, source, target) {
      if (!registry) {
        console.warn('Cannot create a reflex because the source registry does not exist or could no be found.')
        return
      }

      // Get any existing reactions
      let reactions = this.getRegistryReflexReactions(registry)

      // If the specified reactions already exist within the reflex, warn the user.
      if (reactions.hasOwnProperty(source)) {
        console.warn(`The "${registry.selector}" view registry reflex (${source} --> ${target}) was overridden.`)
      }

      // Append/overwrite the reflex reactions with the source and target.
      reactions[source] = target

      let reflex = {
        registry,
        reactions
      }

      // Replace the old reflex configuration with the new one.
      let index = this.getRegistryReflexIndex(registry)

      if (index >= 0) {
        // Updating existing reflexes
        this._reflexes = this._reflexes.splice(index, 1, reflex)
      } else {
        // Create a new reflex
        this._reflexes.push(reflex)

        // Add the registry listener
        registry.on('state.changed', this.reflexHandler(registry))
      }
    }

    /**
     * @method removeReflex
     * Remove a #reflexes mapping dynamically.
     * @param {NGNX.VIEW.Registry} registry
     * The registry to monitor for state changes.
     * @param {string} state
     * The registry state to listen for.
     */
    removeReflex (registry, state) {
      if (this.managesReflex(registry, state)) {
        let reactions = this.getRegistryReflexReactions(registry)

        // Remove the reaction
        delete reactions[state]

        // If this was the last reaction, remove the entire reflex registry
        let index = this.getRegistryReflexIndex(registry)
        if (Object.keys(reactions).length >= 0) {
          // Modify reflex (not empty)
          this._reflexes = this._reflexes.splice(index, 1)
        } else {
          // Remove empty reflex
          this._reflexes = this._reflexes.splice(index, 1, {
            registry,
            reactions
          })

          // Remove orphaned event handler.
          registry.off('state.changed', this.reflexHandler(registry))
        }
      }
    }

    /**
     * @method clearReactions
     * Remove all reactions.
     */
    clearReflexes () {
      this._reflexes.forEach((reflex) => {
        reflex.registry.off('state.changed', this.reflexHandler(reflex.registry))
      })

      this._reflexes = []
    }

    /**
     * @method reflexHandler
     * Respond to reflex events.
     * @param {NGNX.VIEW.Registry} registry
     * The view registry to handle.
     * @private
     */
    reflexHandler (registry) {
      return (change) => {
        let reactions = this.getRegistryReflexReactions(registry)

        if (reactions.hasOwnProperty(registry.state)) {
          this.state = reactions[registry.state]
        }
      }
    }

    /**
     * @method destroy
     * Destroy the DOM element associated with the View Registry.
     * This does not affect any parent elements.
     */
    destroy () {
      if (!NGN.hasOwnProperty('DOM')) {
        throw new Error('NGN.DOM is required to invoke the destroy method.')
      }

      NGN.DOM.destroy(this.self)
    }

    /**
     * @method hide
     * A helper method to hide the primary reference.
     * This is accomplished by setting `display: none;`
     * on the component matching the main #selector.
     * The original `display` value is saved so the #show
     * method can redisplay the element correctly.
     */
    hide () {
      if (this.self.style && this.self.style.display) {
        this.displaystate = NGN.coalesce(this.self.style.display)
      }

      this.self.style.display = 'none'
    }

    /**
     * @method show
     * A helper method to show the primary reference.
     * This is accomplished by setting `display: <ORIGINAL_VALUE>;`
     * on the component matching the main #selector. The original
     * value is saved by the #hide method. If this method is called
     * _before_ #hide is called, the display will be set to `''`.
     */
    show () {
      this.self.style.display = NGN.coalesce(this.displaystate, '')
    }
  }

  NGNX.VIEW = NGNX.VIEW || {}
  NGNX.VIEW.Registry = NgnViewRegistry
  NGNX.ViewRegistry = NGN.deprecateClass(NGNX.VIEW.Registry, 'NGNX.ViewRegistry is now NGNX.VIEW.Registry')
  // Object.defineProperty(NGNX, 'View Registry', NGN.const(View Registry))
}
