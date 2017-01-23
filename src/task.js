'use strict'

if (!NGN) {
  console.error('NGN not found.')
} else {
  NGN.global.NGNX = NGN.global.NGNX || {}

  /**
   * @class NGNX.Task
   * Represents a unit of work as defined by the queue.
   */
  class QueueItem extends NGN.EventEmitter {
    constructor (config) {
      config = config || {}
      super(config)

      Object.defineProperties(this, {
        /**
         * @cfg {string} name
         * Descriptive name of the worker.
         */
        name: NGN.const(NGN.coalesce(config.name, 'Unknown')),

        /**
         * @cfg {function} callback
         * The method to execute when the queue is ready.
         */
        callback: NGN.privateconst(config.callback),

        /**
         * @cfg {number} number
         * The queue item number. This is used primarily as an ID.
         */
        number: NGN.const(parseInt(config.number, 10)),

        timer: NGN.private(null),
        _status: NGN.private(null),
        bus: NGN.private(config.buz),
        _skip: NGN.private(false)
      })

      this.on('timeout', () => {
        this._status = 'timedout'
      })

      this.on('stepskipped', () => {
        this._status = 'skipped'
      })
    }

    /**
     * @property {string} status
     * May be `running`, `complete`, or `null` (not run yet)
     */
    get status () {
      return this._status
    }

    /**
     * @property {boolean} skipped
     * `true` to skip the step, `false` to execute it.
     */
    get skipped () {
      return this._skip
    }

    /**
     * @method run
     * Execute the callback function.
     * @param {string} mode
     * `dev` or `prod`. When in "dev" mode, verbose output is written
     * to the console.
     */
    run (mode) {
      if (this.skipped) {
        this.emit('stepskipped', this)

        if (mode && mode === 'dev') {
          console.warn('SKIPPED ' + this.name)
        }

        return
      }

      this.emit('stepstarted', this)

      if (mode && mode === 'dev') {
        console.info('Executing ' + this.name + ':')
      }

      this._status = 'running'

      const me = this
      const scope = {
        name: this.name,
        number: this.number,
        timeout: function (milliseconds) {
          me.timer = setTimeout(function () {
            me.emit('steptimeout', me)
          }, milliseconds)
        }
      }

      this.callback.apply(scope, [function () {
        me._status = 'complete'
        me.emit('stepcomplete', me)
      }])

      if (this.callback.length === 0) {
        me._status = 'complete'
        me.emit('stepcomplete', me)
      }
    }

    /**
     * @method skip
     * Skip this item
     */
    skip () {
      if (this._status === 'running') {
        console.warn('Cannot skip step: ' + this.name + ' is currently running.')
      } else if (this._status === 'timedout') {
        console.warn('Cannot skip step: ' + this.name + ' timed out.')
      } else if (this._status === 'complete') {
        console.warn('Cannot skip step: ' + this.name + ' already completed.')
      }

      this._skip = true
    }
  }

  Object.defineProperty(NGNX, 'Task', NGN.privateconst(QueueItem))
}
