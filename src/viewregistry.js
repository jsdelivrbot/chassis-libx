'use strict'

if (!NGN) {
  console.error('NGN not found.')
} else {
  window.NGNX = window.NGNX || {}

  /**
   * @class NGNX.ViewRegistry
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
   */
  class ViewRegistry extends NGNX.Driver {
    constructor (cfg) {
      cfg = cfg || {}

      if (typeof cfg !== 'object') {
        throw new Error(`Invalid configuration. Expected Object, received ${typeof cfg}.`)
      }

      if (!cfg.hasOwnProperty('selector')) {
        throw new Error('Missing required configuration attribute: selector')
      }

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
      } else if (cfg.hasOwnProperty('references')) {
        Object.keys(cfg.references).forEach((r) => {
          cfg.references[r] = `${cfg.selector} ${cfg.references[r]}`
        })
      }

      let element = document.querySelector(cfg.selector)

      if (element === null) {
        throw new Error(`Could not find valid DOM element for '${cfg.selector}'`)
      }

      super(cfg)

      /**
       * @cfg {NGNX.ViewRegistry} [parent]
       * The parent View Registry. This optional configuration is commonly used
       * to break large registries into smaller/more managable registries.
       */
      Object.defineProperties(this, {
        /**
         * @cfg {string} selector (required)
         * The CSS selector string of the DOM element to manage. This is used
         * as the "root" of all NGN references & events.
         */
        selector: NGN.const(cfg.selector)
      })

      // Create a self reference by Driver ID (inherited)
      NGN.ref.create(this.id, this.selector)
    }

    /**
     * @property {NGN.ref} element
     * The NGN reference to the DOM #selector DOM element.
     * @readonly
     */
    get self () {
      return NGN.ref[this.id]
    }
  }

  Object.defineProperty(NGNX, 'ViewRegistry', NGN.const(ViewRegistry))
}
