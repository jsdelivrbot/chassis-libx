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
    }),

    /**
     * @method guaranteeVariable
     * This method checks for the existance of a variable and executes the
     * callback when it is recognized. This is designed to check for the
     * existance of a javascript variable and react when it is recognized.
     *
     * For example:
     *
     * ```js
     * NGNX.util.guaranteeVariable(myVar, function () {
     *   // ... do something ...
     *   console.log('Simon says:', myVar)
     * })
     *
     * setTimeout(function () {
     *   window.myVar = 'I exist!'
     * }, 5000)
     * ```
     *
     * In this example, 5 seconds will pass before `myVar` is created. When it
     * is created, the `guaranteeVariable` method is executed, outputting
     * `Simon says: I exist!`.
     *
     * This method may be used for many purposes, but it was designed to
     * monitor the JavaScript environment to detect dynamically loaded code.
     * This can be particularly useful when creating NGNX.VIEW.Registry or
     * NGNX.VIEW.Component objects on the fly.
     *
     * This polls the environment every 300 milliseconds (by default) for
     * the variable. A custom interval may be specified, but there is a minimum
     * of 10ms to prevent abuse & DOM thrashing.
     *
     * This method determines whether the variable exists by checking whether
     * it is `undefined`. If it is defined (even if its value is `null`),
     * it is considered to "exist" and the callback will be executed. If the
     * specified variable already exists, the callback will be executed immediately.
     * @param {String} variable
     * The string name of the variable to watch for.
     * @param {Number} [interval=300]
     * The number of milliseconds between checks.
     * @param {function|string} callback
     * The callback to execute when the variable exists. This may also be the
     * name of an event that will be fired on the NGN.BUS instead of executing
     * a callback. If an event is used instead of a callback, only the variable
     * name is provided as an argument to event handlers.
     * @param {Any} callback.value
     * Returns the value of the variable.
     */
    guaranteeVariable: NGN.const((monitorVariable, interval, callback) => {
      if (NGN.isFn(interval) || isNaN(interval)) {
        callback = interval
        interval = 300
      }

      // Enforce minimum interval
      interval = interval < 10 ? 10 : interval

      // Prevent code injection
      monitorVariable = monitorVariable.replace(/\;|\(|\)|\{|\}|\=/gi, '') // eslint-disable-line no-useless-escape

      // Scope the function to sandbox the eval method
      let checkVariable = function () {
        let result

        try {
          result = eval(monitorVariable) // eslint-disable-line no-eval
        } catch (e) {
          return setTimeout(checkVariable, interval)
        }

        if (NGN.isFn(callback)) {
          callback(monitorVariable, result)
        } else {
          NGN.BUS && NGN.BUS.emit(callback, monitorVariable)
        }
      }

      checkVariable()
    })
  })
}
