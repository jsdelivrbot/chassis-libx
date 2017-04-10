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
  class NgnViewComponent extends NGNX.VIEW.Registry {
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

      let parent // eslint-disable-line no-unused-vars

      if (cfg.hasOwnProperty('parent')) {
        parent = cfg.parent.self // eslint-disable-line no-unused-vars
      }

      cfg.selector = NGN.DOM.getElementSelector(cfg.element, NGN.coalesce(parent, document.body)) // eslint-disable-line no-undef

      cfg.namespace = NGN.coalesce(cfg.namespace, '')
      cfg.namespace = (cfg.namespace.length > 0 ? '.' : '') + NGN.DATA.util.GUID() + '.'

      super(cfg)
    }
  }

  NGNX.VIEW.Component = NgnViewComponent
}
