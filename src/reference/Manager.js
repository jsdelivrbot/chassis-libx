'use strict'

/**
 * @class NGNX.REF
 * A global catalog of "pointers" that reference one or more DOM elements.
 * This is used to reference and manipulate DOM elements in a simple
 * and standardized way, without restricting native functionality.
 * This namespace is also recognized as `NGNX.ref`.
 * @singleton
 * @fires created
 * Triggered when a new reference is created. An object containing reference
 * details is provided as an argument to event handlers.
 * ```js
 * {
 *   name: 'reference_name',
 *   reference: <HTMLReferenceElement>
 * }
 * @fires deleted
 * Triggered when a reference is deleted. An object containing the old reference
 * details is provided as an argument to event handlers.
 * ```js
 * {
 *   name: 'reference_name',
 *   reference: <HTMLReferenceElement>
 * }
 */
window.NGNX = NGN.coalesce(window.NGNX, {})

NGNX.REF = function () {
  class ReferenceManager extends NGN.EventEmitter {
    constructor () {
      super()

      Object.defineProperties(this, {
        collection: NGN.private([]),
        deepcollapse: NGN.private(false)
      })
    }

    /**
     * @property {Array} keys
     * A list of keys maintained by the reference manager.
     * @private
     */
    get keys () {
      return NGN.dedupe(this.collection)
    }

    /**
     * @property json
     * A JSON representation of the managed keys and their associated selectors.
     * @returns {Object}
     * A key:selector object.
     */
    get json () {
      let data = {}

      for (let i = 0; i < this.collection.length; i++) {
        data[this.collection[i]] = this[this.collection[i]].selector
      }

      return data
    }

    /**
     * @method create
     * Add a reference.
     * @param {String} [key]
     * The key/name of the reference. For example, if this is `myElement`,
     * then `ref.myElement` will return a pointer to this reference.
     * @param {string} selector
     * The CSS selector path.
     */
    create (key, selector) {
      let reference = new HTMLReferenceElement(selector)

      Object.defineProperty(this, key, {
        configurable: true,
        enumerable: true,
        get () {
          return reference
        },

        set (newselector) {
          reference.selector = newselector
        }
      })

      this.collection.push(key)

      this.emit('created', {
        name: key,
        reference: this[key]
      })

      return reference
    }

    /**
     * @method remove
     * Removes a key from the reference manager.
     * @param {string} name
     * The name of the reference.
     */
    remove (key) {
      if (!key) {
        return
      }

      if (!this.hasOwnProperty(key)) {
        return
      }

      let oldReference = NGN.slice(this[key])[0]

      delete this[key]

      while (this.collection.indexOf(key) >= 0) {
        this.collection.splice(this.collection.indexOf(key), 1)
      }

      this.emit('deleted', {
        name: key,
        reference: oldReference
      })
    }

    /**
     * @method find
     * A generic find method that finds and returns an element or
     * a collection of elements. This is similar to `document.querySelectorAll`,
     * except it returns an NGN reference.
     * @param {string} selector
     * A CSS selector string representing the.
     * @returns HTMLReferenceElement
     */
    find (selector) {
      if (typeof selector !== 'string' || selector.trim().length === 0) {
        throw new Error(`NGN.REF.find requires a string argument.`)
      }

      return new HTMLReferenceElement(NGN.DOM.normalizeSelector(selector))
    }

    /**
     * @method enableComplexEventCompression
     * By default, NGN attempts to minimize the number of event
     * handlers applied to the DOM by references. When a reference refers to
     * multiple elements instead of just one, NGN attempts to aggregate event
     * handlers using a simplistic strategy of applying a single event listener
     * to a shared parent node. In most cases, this can reduce "event emitter
     * waste". The simplistic strategy is designed for the 95% use case, wherein
     * most DOM structure references are not very large. However; it is
     * still possible to have complex references. Complex event compression has a
     * native algorithm that finds the least common ancestor (i.e. common DOM
     * element) and applies the event handler to it, distributing events directly
     * to referenced DOM nodes within it. It automatically makes a decision
     * to determine if the gap between nodes is too large (a factor of 3) to
     * effectively determine whether event compression will yield tangible
     * performance gains. If the algorithm does not determine gains, event
     * handlers are applied to individual elements within the reference. Simply
     * put, it falls back to adding an event handler to each referenced element.
     *
     * Since this is not necessary in most cases, it is off by default. Enabling
     * it will perform the analysis and apply efficiencies when possible.
     */
    enableComplexEventCompression () {
      if (!NGN.DOM) {
        console.warn('Complex event compression requires NGN.DOM, which was not found. Complex compression will be ignored.')
        return
      }

      this.deepcollapse = true

      if (this.keys.length > 0) {
        this.keys.forEach((ref) => this[ref].enableComplexEventCompression())
      }
    }

    /**
     * @method disableComplexEventCompression
     * Disables complex event compression.
     */
    disableComplexEventCompression () {
      this.deepcollapse = false

      if (this.keys.length > 0) {
        this.keys.forEach((ref) => this[ref].disableComplexEventCompression())
      }
    }
  }

  return new ReferenceManager()
}

NGNX.REF = new NGNX.REF()
NGN.createAlias(NGNX, 'ref', NGNX.REF)
