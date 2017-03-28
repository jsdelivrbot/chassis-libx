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
   * let myReg = new NGNX.ViewRegistry({
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
  class ViewRegistry extends NGNX.Driver {
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
       * @cfg {NGNX.ViewRegistry} [parent]
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
         * @cfg {NGNX.ViewRegistry} parent
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
         * let Registry = new NGNX.ViewRegistry({
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
         * let Registry = new NGNX.ViewRegistry({
         *   parent: MyParentViewRegistry,
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
         * MyParentViewRegistry.state = 'connected'
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
         * let Registry = new NGNX.ViewRegistry({
         *   parent: MyParentViewRegistry,
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
         * let MyReg = new NGNX.ViewRegistry({
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
      })

      // If reflexes exist as an object, convert to an array
      if (!Array.isArray(this._reflexes)) {
        this._reflexes = [this._reflexes]
      }

      // Create a self reference by Driver ID (inherited)
      NGN.ref.create(this.id, this.selector)

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
          this.emit('property.changed', {
            property: change.field,
            old: change.old,
            new: change.new
          })
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
              console.warn(`The %c${scope}%c state handler on line ${NGN.stack.pop().line} references the lexical %c\"this\"%c scope, which may be the cause of the error if the handler is defined as a fat arrow function. This can be resolved by using a real function instead of a fat arrow function.`, NGN.css, 'font-weight: 100;', NGN.css, 'font-weight: 100;')
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

      // Assure a default state method exists
      if (!this._states.hasOwnProperty('default')) {
        this._states['default'] = function () {} // No-op default
      }

      // Set the initial state.
      if (this.initialstate !== this._state && this.managesState(this.initialstate)) {
        NGNX.util.requeue(() => {
          this.state = this.initialstate
        })
      } else if (this._state === 'default') {
        this._states.default()
      }

      // Apply state changes
      this.on('state.changed', (change) => {
        let newstate = NGN.coalesce(change.new, 'default')

        if (!this._states.hasOwnProperty(newstate)) {
          console.warn(`Could not change from %c${change.old}%c to %c${newstate}%c state. %c${newstate}%c is not a valid state. Valid states include: %c${Object.keys(this._states).join(', ')}`, NGN.css, '', NGN.css, '', NGN.css, '', NGN.css)
          console.info(NGN.stack)
          throw new Error('Invalid state change.')
        }

        this._states[newstate].apply(this, arguments)
      })

      if (this.monitoring) {
        this.enableElementMonitor()
      }
    }

    /**
     * @property {NGNX.ViewRegistry} parent
     * Returns the parent registry or `null` if there is no parent.
     */
    get parent () {
      return NGN.coalesce(this._parent)
    }

    /**
     * @property {NGN.ref} element
     * The NGN reference to the DOM #selector DOM element.
     * @readonly
     */
    get self () {
      return NGN.ref[this.id]
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
      // If there is no change, don't update the state.
      if (this.state === value) {
        return
      }

      if (!this.managesState(value)) {
        throw new Error(value + ' is not state managed by the ViewRegistry.')
      }

      this._previousstate = this.state
      this._state = value.toString().trim()

      this.emit('state.changed', {
        old: this._previousstate,
        new: this._state
      })
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
      return this._states.hasOwnProperty(state) && typeof this._states[state] === 'function'
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
     * @param {NGNX.ViewRegistry} registry
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
     * @param {NGNX.ViewRegistry} registry
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
     * @param {NGNX.ViewRegistry} registry
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
     * @param NGNX.ViewRegistry} registry
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
     * @param {NGNX.ViewRegistry} registry
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
     * @param {NGNX.ViewRegistry} registry
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
     * @param {NGNX.ViewRegistry} registry
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
     * Destroy the DOM element associated with the ViewRegistry.
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
  NGNX.VIEW.Registry = ViewRegistry
  NGNX.ViewRegistry = NGN.deprecateClass(NGNX.VIEW.Registry, 'NGNX.ViewRegistry is now NGNX.VIEW.Registry')
  // Object.defineProperty(NGNX, 'ViewRegistry', NGN.const(ViewRegistry))
}
