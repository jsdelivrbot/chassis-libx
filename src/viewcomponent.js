'use strict'

if (!NGNX) {
  console.error('NGNX not found.')
} else if (!NGNX.VIEW) {
  console.error('NGNX.VIEW namespace not found.')
} else if (!NGNX.VIEW.Registry) {
  console.error('NGNX.VIEW.Registry not found.')
} else {
  /**
   * @class NGNX.VIEW.Component
   * A view component is a reusable NGNX.VIEW.Registry that belongs to
   * a specific element.
   */
  class Component extends NGNX.VIEW.Registry {
    constructor (cfg) {
      cfg = cfg || {}

      /**
       * @cfg {HTMLElement} element
       * The DOM element used as a component.
       */
      if (!cfg.hasOwnProperty('element')) {
        throw new Error('A required configuration attribute (element) was not defined.')
      } else if (!(cfg.element instanceof Element)) {
        throw new Error('The specified element is a not a valid DOM element.')
      }

      cfg.selector = NGN.DOM.selectorOfElement(cfg.element, NGN.coalesce(cfg.parent, document.body))

      cfg.id = NGN.coalesce(cfg.namespace, '')
      cfg.id = (cfg.id.length > 0 ? '.' : '') + NGN.DATA.util.GUID() + '.'

      super(cfg)
    }
  }

  NGNX.VIEW.Component = Component
}
