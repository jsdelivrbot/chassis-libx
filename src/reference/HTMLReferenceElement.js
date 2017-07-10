'use strict'

// Throw an error if the DOM library isn't included.
// NGN.needs(NGN, 'DOM')

/**
 * @class HTMLReferenceElement
 * A class representing a reference to a Node/NodeList.
 * @global
 */
class HTMLReferenceElement { // eslint-disable-line no-unused-vars
  constructor (selector = '') {
    if (typeof selector !== 'string' || selector.trim().length === 0) {
      throw new Error(`Invalid reference selector. Reference selectors must be a string, received ${typeof selector}`)
    }

    let selection = NGN.DOM.normalizeSelector(selector)

    Object.defineProperties(this, {
      /**
       * @cfg {string} selector
       * The CSS selector representing the referenced element(s).
       */
      originalselector: NGN.privateconst(selection),
      activeselector: NGN.private(selector),
      deepcollapse: NGN.private(false),
      smartevents: NGN.private(true),

      filters: NGN.private(null),

      getValue: NGN.private((attribute) => {
        if (this.length === 1) {
          return this.element[attribute]
        }

        return this.elements.map((element) => element[attribute])
      }),

      setValue: NGN.private((attribute, value) => {
        switch (this.length) {
          case 0:
            return

          case 1:
            this.element[attribute] = value
            return

          default:
            if (NGN.isArray(value)) {
              this.each((element) => {
                if (value.length > 0) {
                  element[attribute] = value.shift()
                }
              })
            }
        }
      })
    })

    // Apply common getter/setter proxies
    // These are experimental
    let attributes = [
      'value',
      'innerHTML',
      'outerHTML',
      'style',
      'tabIndex',
      'title',
      'className',
      'attributes',
      'childElementCount',
      'children',
      // 'className',
      'clientHeight',
      'clientLeft',
      'clientTop',
      'clientWidth',
      'firstElementChild',
      'id',
      // 'innerHTML',
      'lastElementChild',
      'localName',
      'name',
      'namespaceURI',
      'nextElementSibling',
      'ongotpointercapture',
      'onlostpointercapture',
      'onwheel',
      // 'outerHTML',
      'prefix',
      'previousElementSibling',
      'scrollHeight',
      'scrollLeft',
      'scrollTop',
      'scrollWidth',
      'shadowRoot',
      'slot',
      'tabStop',
      'tagName'
    ]

    attributes.forEach((attribute) => {
      Object.defineProperty(this, attribute, {
        enumerable: false,
        get: () => {
          NGN.BUS && NGN.BUS.emit('NGN.ADVISORY.EXPERIMENTAL', `{attribute} is an experimental attribute of NGNX.REF.`)
          return this.getValue(attribute)
        },
        set: (value) => {
          NGN.BUS && NGN.BUS.emit('NGN.ADVISORY.EXPERIMENTAL', `Setting {attribute} is an experimental feature of NGNX.REF.`)
          this.setValue(attribute, value)
        }
      })
    })

    selection = null
  }

  /**
   * @property {Boolean} [eventCompression=true]
   * Use smart event compression.
   */
  get eventCompression () {
    return this.smartevents
  }

  set eventCompression (value) {
    if (NGN.typeof(value) !== 'boolean') {
      throw new Error('HTMLReferenceElement.eventCompression cannot be set to a non-boolean value.')
    }

    this.smartevents = value
  }

  /**
   * @property {string} selector
   * The active CSS selector used to reference elements.
   */
  get selector () {
    return this.activeselector
  }

  set selector (value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error('Cannot set HTMLReferenceElement selector to a non-string or empty value.')
    }

    this.activeselector = value
  }

  /**
   * @property {Node|NodeList} element
   * Retrieve the raw Node or NodeList represented by the reference.
   */
  get element () {
    let elements = document.querySelectorAll(this.selector)

    switch (elements.length) {
      case 0:
        return null

      case 1:
        return elements[0]

      default:
        return elements
    }
  }

  /**
   * @property {Array} elements
   * Retrieves the elements as an array. If the reference refers to a
   * NodeList, the NodeList will be converted to a standard Array for
   * easy iteration.
   */
  get elements () {
    if (!this.filters) {
      return NGN.slice(this.element)
    }

    // Filter the elements and return the results.
    return NGN.slice(this.element).filter((element, elementIndex, elementList) => {
      for (let filterIndex in this.filters) {
        let keep = this.filters[filterIndex](element, elementIndex, elementList)

        if (!keep) {
          return false
        }
      }

      return true
    })
  }

  /**
   * @property {Number} length
   * The number of DOM elements represented by this reference.
   */
  get length () {
    return document.querySelectorAll(this.selector).length
  }

  /**
   * @property {Boolean} empty
   * Returns `true` if the reference contains no elements.
   */
  get empty () {
    return this.length === 0
  }

  /**
   * @property {Object} eachClassList
   * This is a unique convenience property of an HTMLReferenceElement. This is
   * **not a standard DOM property**. To reference the native `classList` of
   * an element, use the #element attribute to retrieve the raw DOM element.
   *
   * This property provides 4 methods: `add`, `remove`, `toggle`, and `replace`.
   *
   * Each of these methods conform to their corresponding
   * [Element.classList](https://developer.mozilla.org/en-US/docs/Web/API/Element/classList)
   * methods, but the methods will be applied to each element represented by the
   * selector. In other words, this will apply the same method to each element
   * instead of having to iterate through a NodeList to apply them one at a time.
   *
   * For example:
   *
   * ```html
   * <div class="my">
   *   <div class="selector">A</div>
   *   <div class="selector">B</div>
   *   <div class="selector">C</div>
   * </div>
   * ```
   *
   * ```js
   * let ref = new HTMLReferenceElement('.my .selector')
   *
   * ref.eachClassList.add('blue')
   * ```
   *
   * This results in:
   *
   * ```html
   * <div class="my">
   *   <div class="blue selector">A</div> // "blue" class now exists.
   *   <div class="blue selector">B</div> // "blue" class now exists.
   *   <div class="blue selector">C</div> // "blue" class now exists.
   * </div>
   * ```
   */
  get eachClassList () {
    const me = this
    let methods = ['add', 'remove', 'toggle']
    let proxy = {}

    methods.forEach((method) => {
      proxy[method] = function () {
        me.each((element) => element.classList[method](...arguments))
      }
    })

    // Add replace method
    proxy.replace = function (oldClass, newClass) {
      me.each((element) => {
        element.classList.add(newClass)
        element.classList.remove(oldClass)
      })
    }

    return proxy
  }

  /**
   * @method find
   * @param  {String} selector
   * Search within the existing reference for an element matching this selector.
   * @return {HTMLReferenceElement}
   */
  find (selector = '') {
    if (typeof selector !== 'string' || selector.trim().length === 0) {
      throw new Error(`HTMLReferenceElement.find requires a string argument.`)
    }

    let search = NGN.DOM.normalizeSelector(`${this.selector} ${selector}`)

    return new HTMLReferenceElement(search)
  }

  // Alias find for convenience, but warn that it's not really supported
  querySelector () {
    console.warn('querySelector is not a valid HTMLReferenceElement method. Using find() instead.')
    this.find(...arguments)
  }

  // Alias find for convenience, but warn that it's not really supported
  querySelectorAll () {
    console.warn('querySelectorAll is not a valid HTMLReferenceElement method. Using find() instead.')
    this.find(...arguments)
  }

  /**
   * @method each
   * Iterate through the referenced elements and apply a function to each.
   * @param  {Function} appliedFn
   * The function to apply to each element. This function receives a single
   * [Node](https://developer.mozilla.org/en-US/docs/Web/API/Node), the index
   * of the node within the reference collection, and the entire collection
   * as arguments (similar to Array.forEach).
   */
  each (fn) {
    if (this.empty) {
      return
    }

    let elements = this.length === 1 ? [this.element] : this.elements

    elements.forEach((element, index, elementList) => fn(element, index, elementList))
  }

  forEach () {
    this.each(...arguments)
  }

  /**
   * @method setEachAttribute
   * This method iterates through each of the elements of the reference,
   * applying the
   * [setAttribute](https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute)
   * method to each.
   * @param {String} name
   * The name of the attribute to set.
   * @param {String} value
   * The value to assign the attribute.
   */
  setEachAttribute (key, value) {
    this.each((element) => element.setAttribute(key, value))
  }

  /**
   * @method removeEachAttribute
   * This method iterates through each of the elements of the reference,
   * applying the
   * [removeAttribute](https://developer.mozilla.org/en-US/docs/Web/API/Element/removeAttribute)
   * method to each.
   * @param {String} name
   * The name of the attribute to set.
   */
  removeEachAttribute (key) {
    this.each((element) => element.removeAttribute(key))
  }

  /**
   * @method applyFilter
   * Add a new element filter.
   * @param {Function} filterFn
   * The filter function receives a single
   * [Node](https://developer.mozilla.org/en-US/docs/Web/API/Node) argument. The
   * function must return `true` if the filter should "keep" the element or
   * `false` if the element should not be included in the results.
   */
  applyFilter (filterFn) {
    if (!NGN.isFn(filterFn)) {
      throw new Error('Invalid function passed to HTMLReferenceElement.applyFilter().')
    }

    this.filters = NGN.coalesce(this.filters, [])
    this.filters.push(filterFn)
  }

  /**
   * @method clearFilters
   * Removes all filters from the reference.
   */
  clearFilters () {
    this.filters = null
  }

  /**
   * @method destroy
   * Destroys all referenced elements using NGN.DOM.destroy.
   */
  destroy () {
    this.each((element) => NGN.DOM.destroy(element))
  }

  /**
   * @method wrapHandlerMethod
   * Applies a `referenceElement` to an event before it is passed to a handler.
   * @param  {function} handlerFn
   * The event handler function to wrap.
   * @return {function}
   * @private
   */
  wrapHandlerMethod (handlerFn) {
    const me = this

    return (event) => {
      let elements = document.querySelectorAll(this.originalselector)
      let referenceElement = null

      for (let i = 0; i < elements.length; i++) {
        if (elements[i] === event.target) {
          referenceElement = event.target
        }
      }

      referenceElement = NGN.coalesce(referenceElement, NGN.DOM.findParent(event.target, this.originalselector))

      if (referenceElement === null) {
        retrun
      }

      event.referenceElement = referenceElement

      handlerFn(event)
    }
  }

  /**
   * @method on
   * Apply event handlers for one or more events. This is similar to the native
   * `addEventListener` method with a multiple distinct differences.
   *
   * First, the event handler will be applied to all referenced elements.
   * Each element will receive the same event handler function. If this is not
   * desired behavior, the #each method can be used to iterate through elements
   * to use the standard `addEventListener` method, or the #applyFilter method
   * can be used to restrict which elements this method will be applied to.
   *
   * Second, it is possible to pass a simple key/value object containing multiple
   * event name/handler combinations. For example:
   *
   * ```js
   * let ref = new HTMLReferenceElement('.my .input')
   *
   * ref.on({
   *   keydown: function (event) {...},
   *   keyup: function (event) {...},
   *   focus: function (event) {...},
   *   blur: function (event) {...}
   * })
   * ```
   *
   * Third, references use a smart event compression system whenever possible.
   * By reducing the number of events and handlers, it is easier to trace the
   * flow of data/state/etc through a UI system.
   *
   * There are two forms of event compression, simple and complex. Simple event
   * compression attempts to check each referenced element for a shared parent
   * node. If they all share a common parent, the event handler is applied
   * to the parent node, and the handler is executed only when a referenced
   * element is affected. For complex event compression, a common ancestor
   * element is used, along with a practicality algorithm to determine whether
   * event aggregation will make the app more efficient. **This system is ignored
   * for incompatible events**. An example of an incompatible event is `keydown`,
   * which must be applied to each `<input>` element. In most cases, the smart
   * compression system will simply work, but it will fall back to applying
   * event handlers one-by-one to each element if compression cannot be applied.
   * This behavior can be disabled. See #enableComplexEventCompression
   * for details.
   * @param  {String|Object} eventName
   * The event name to listen for. Alternatively, this can be a key/value
   * object containing multiple events/handlers.
   *
   * **Example:**
   * ```js
   * {
   *   click: function (event) {...},
   *   keyup: function (event) {...},
   *   focus: function (event) {...},
   *   blur: function (event) {...}
   * }
   * ```
   * @param  {Function} [handlerFn]
   * The handler function for an event. This is ignored if an object is passed
   * as the `eventName`.
   */
  on (scope, handlerFn) {
    if (this.empty) {
      return
    }

    let elements = this.eventCompression
      ? this.getCollapsedDomStructure()
      : this.elements

    elements = NGN.typeof(elements) === 'array' ? elements : [elements]

    if (typeof scope === 'object') {
      for (let eventName in scope) {
        elements.forEach((element) => element.addEventListener(eventName, this.wrapHandlerMethod(scope[eventName])))
      }
    } else {
      elements.forEach((element) => element.addEventListener(scope, this.wrapHandlerMethod(handlerFn)))
    }
  }

  pool () {
    return NGN.deprecate(this.on, 'NGNX.REF.pool has been merged into NGNX.REF.on().')
  }

  /**
   * @method once
   * The same as #on, but the event handler is removed after the event is fired.
   * @param  {String|Object} eventName
   * The event name to listen for. Alternatively, this can be a key/value
   * object containing multiple events/handlers.
   *
   * **Example:**
   * ```js
   * {
   *   click: function (event) {...},
   *   keyup: function (event) {...},
   *   focus: function (event) {...},
   *   blur: function (event) {...}
   * }
   * ```
   * @param  {Function} [handlerFn]
   * The handler function for an event. This is ignored if an object is passed
   * as the `eventName`.
   */
  once (scope, handlerFn) {
    if (this.empty) {
      return
    }

    let elements = this.eventCompression
      ? this.getCollapsedDomStructure()
      : this.elements

    elements = NGN.typeof(elements) === 'array' ? elements : [elements]

    const me = this

    if (typeof scope === 'object') {
      for (let eventName in scope) {
        let fn = function (evt) {
          scope[eventName].apply(...arguments)
          me.off(eventName, fn)
        }

        elements.forEach((element) => element.addEventListener(eventName, this.wrapHandlerMethod(fn)))
      }
    } else {
      let fn = function (evt) {
        handlerFn.apply(...arguments)
        me.off(scope, fn)
      }

      elements.forEach((element) => element.addEventListener(scope, this.wrapHandlerMethod(fn)))
    }
  }

  /**
   * @method off
   * Remove an existing event handler. This can remove event handlers set with
   * the #on method or those set directly on an element.
   * @param  {String|Object} eventName
   * The event name. Alternatively, this can be a key/value
   * object containing multiple events/handlers.
   *
   * **Example:**
   * ```js
   * {
   *   click: function (event) {...},
   *   keyup: function (event) {...},
   *   focus: function (event) {...},
   *   blur: function (event) {...}
   * }
   * ```
   * @param  {Function} [handlerFn]
   * The handler function to remove. This is ignored if an object is passed
   * as the `eventName`.
   */
  off (scope, handlerFn) {
    if (this.empty) {
      return
    }

    let elements = this.eventCompression
      ? this.getCollapsedDomStructure()
      : this.elements

    elements = NGN.typeof(elements) === 'array' ? elements : [elements]

    if (typeof scope === 'object') {
      for (let eventName in scope) {
        elements.forEach((element) => element.removeEventListener(eventName, this.wrapHandlerMethod(scope[eventName])))
      }
    } else {
      elements.forEach((element) => element.removeEventListener(scope, this.wrapHandlerMethod(handlerFn)))
    }
  }

  // Convenience alias
  onceoff () {
    console.warn('HTMLReferenceElement.off can be used for removing any event handler (including one-time events).')
    this.off(...arguments)
  }

  // Convenience alias
  offonce () {
    this.onceoff(...arguments)
  }

  // Convenience alias
  addEventListener () {
    console.warn('HTMLReferenceElement.addEventListener is not a valid method. Using HTMLReferenceElement.on instead.')
    this.on(...arguments)
  }

  // Convenience alias
  removeEventListener () {
    console.warn('HTMLReferenceElement.removeEventListener is not a valid method. Using HTMLReferenceElement.off instead.')
    this.off(...arguments)
  }

  /**
   * @method forward
   * Forwards a DOM/Element event to the NGN.BUS. See @NGN.BUS#forward for
   * additional details.
   * @param {string|object} sourceEvent
   * The source event triggered by the DOM element(s). This may also be a
   * key/value object containing multiple forwards. For example:
   *
   * ```js
   * {
   *   click: 'clicked',
   *   dblclick: 'double.clicked'
   * }
   * ```
   * @param {string} targetEvent
   * The event fired on the NGN.BUS when the sourceEvent is fired.
   * This is ignored if an object is passed to the `sourceEvent`.
   * @param {Boolean} [preventDefault=false]
   * Optionally prevent the default event from happning. This is
   * the equivalent of adding `event.preventDefault()` at the beginning
   * of an event handler.
   */
  forward (sourceEvent, targetEvent, preventDefault = false) {
    if (this.empty) {
      return
    }

    if (!NGN.BUS) {
      throw new MissingDependencyError('NGN.BUS is missing. HTMLReferenceElement.forward requires this to work.')
    }

    if (typeof sourceEvent === 'object' && typeof targetEvent === 'boolean') {
      preventDefault = targetEvent
    }

    let elements = this.eventCompression
      ? this.getCollapsedDomStructure()
      : this.elements

    elements = NGN.typeof(elements) === 'array' ? elements : [elements]

    if (typeof sourceEvent === 'object') {
      for (let eventName in sourceEvent) {
        let fn = (evt) => {
          if (preventDefault) {
            evt.preventDefault()
          }

          NGN.BUS.emit(sourceEvent[eventName], evt)
        }

        elements.forEach((element) => element.addEventListener(eventName, this.wrapHandlerMethod(fn)))
      }
    } else {
      let fn = (evt) => {
        if (preventDefault) {
          evt.preventDefault()
        }

        NGN.BUS.emit(targetEvent, evt)
      }

      elements.forEach((element) => element.addEventListener(sourceEvent, this.wrapHandlerMethod(fn)))
    }
  }

  /**
   * @method getCollapsedDomStructure
   * Retrieves the most effective DOM elements to apply event handlers
   * to when multiple elements are selected.
   * @private
   */
  getCollapsedDomStructure () {
    let elements = this.elements

    // If there's only one element, ignore this operation.
    if (elements <= 1) {
      return this.element
    }

    // Attempt simplistic collapse using parent nodes
    // This is the most common code structure.
    let parentNodes = NGN.dedupe(elements.map((node) => {
      return node.parentNode
    }))

    if ((parentNodes.length / elements.length) < 0.5) {
      return parentNodes
    }

    if (!this.deepcollapse) {
      return elements
    }

    // If complex event compression is configured, apply it.
    let ancestor = NGN.DOM.getCommonAncestorDetail(elements)

    // If the avg is less than the median, the spread is
    // "skewed" and may not benefit from compression. If the
    // average is over 10, the structure is deeply nested and
    // potentially contains many elements to scan through.
    // It's unlikely event collapsing will be beneficial in
    // either of these cases.
    if (ancestor.gap.average < ancestor.gap.median || ancestor.gap.average >= 10) {
      return elements
    }

    if (ancestor === document.body) {
      return elements
    }

    return [ancestor.element]
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
    this.deepcollapse = true
  }

  /**
   * @method disableComplexEventCompression
   * Disables complex event compression.
   */
  disableComplexEventCompression () {
    this.deepcollapse = false
  }
}
