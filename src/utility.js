'use strict'

if (!NGN) {
  console.error('NGN not found.')
} else {
  NGN.global.NGNX = NGN.global.NGNX || {}

  /**
   * @class NGNX.util
   * A utility library for NGNX.
   * @singleton
   */
  NGNX.util = Object.defineProperties({}, {
    /**
     * @method requeue
     * This forces the function to requeue. It is the equivalent of:
     *
     * ```js
     * setTimeout(myFunction, 0)
     * ```
     * @param {function} fn
     * The function/method to requeue.
     */
    requeue: NGN.const((fn) => {
      setTimeout(fn, 0)
    })
  })
}
