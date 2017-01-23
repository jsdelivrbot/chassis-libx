'use strict'

if (!NGN) {
  console.error('NGN not found.')
} else {
  if (!NGNX.Task) {
    throw new Error('NGNX.TaskRunner is dependent on the existance of NGNX.Task, which could not be found.')
  }

  /**
   * @class NGNX.TaskRunner
   * A general task runner capable of executing tasks
   * in parallel or sequentially. This is the UI equivalent
   * of the node [shortbus](https://github.com/coreybutler/shortbus) module.
   */
  class TaskRunner extends NGN.EventEmitter {
    /**
     * @constructor
     * @param {string} [mode=production]
     * Set this to `dev` for verbose console output.
     */
    constructor (mode) {
      super()

      Object.defineProperties(this, {
        steps: NGN.private([]),
        completed: NGN.private(0),
        timeout: NGN.private(null),
        _mode: NGN.private(NGN.coalesce(mode, 'production')),
        _cancel: NGN.private(false),
        processing: NGN.private(false),
        timer: NGN.private(null),
        sequential: NGN.private(false)
      })

      this.on('stepcomplete', (step) => {
        if (this.sequential) {
          return
        }

        // Disallow duplicates
        if (step.status === 'completed') {
          return
        }

        step._status = 'complete'

        // When the step is done, tally it
        this.completed++
        if (this.mode === 'dev') {
          console.info(step.name + ' completed.')
        }

        // If all of the queries have been tallied, we're done.
        if (this.completed === this.steps.length) {
          this.processing = false

          Object.keys(this.steps).forEach((step) => {
            clearTimeout(this.steps[step].timer)
          })

          this.emit('complete')
        }
      })

      this.on('aborting', () => {
        this._cancel = true
      })
    }

    get list () {
      return this.steps.map(function (s) {
        return {
          id: s.number,
          name: s.name,
          status: s.status
        }
      })
    }

    /**
     * @property {string} mode
     * The type of processing (dev, production, etc). Setting this to
     * `dev` enables verbose logging.
     */
    get mode () {
      return this._mode
    }

    set mode (value) {
      if (value.toLowerCase().substr(0, 3) === 'dev') {
        this._mode = 'dev'
      } else {
        this._mode = 'production'
      }
    }

    get cancelled () {
      return this._cancel
    }

    onTimeout () {
      let log = []
      if (this.steps.length > 0) {
        this.steps.forEach(function (s) {
          log.push(s.name, s.status === null ? 'NOT STARTED' : s.status)
        })
      }
      this.emit('timeout', {
        process: log
      })
    }

    /**
     * @method add
     * @param {string} [name]
     * A descriptive name for the queued process/task.
     * @param {function} callback
     * The function to queue.
     * @param {function} callback.next
     * This argument allows users to explicitly use asynchronous
     * methods. Example:
     *
     * ```
     * let tasks = new NGNX.TaskRunner()
     *
     * tasks.add('Descriptive Title', function (next) {
     *   myAsyncMethod(function () {
     *     console.log('Ran something async.')
     *     next()
     *   })
     * })
     */
    add (name, fn) {
      if (this.processing) {
        return console.warn('Cannot add a step while processing.')
      }

      if (typeof name === 'function') {
        fn = name
        name = 'Step ' + (parseInt(this.steps.length) + 1)
      }

      if (typeof fn !== 'function') {
        throw new Error('No processing method defined for step ' + (parseInt(this.steps.length) + 1) + '.')
      }

      const me = this
      const queue = new NGNX.Task({
        name: name,
        callback: fn,
        number: (this.steps.length > 0 ? this.steps[this.steps.length - 1].number : 0) + 1
      })

      queue.on('stepcomplete', function (step) {
        me.emit('stepcomplete', step)
      })

      queue.on('steptimeout', function (step) {
        if (step.status === 'running') {
          me.emit('steptimeout', step)
        }
      })

      this.steps.push(queue)
      this.emit('stepadded', queue)
    }

    /**
     * @method getAt
     * @param  {number} index
     * Retrieve a queue item by it's index/queue number.
     * @return {Queue}
     */
    getAt (index) {
      return this.steps[index]
    }

    /**
     * @method get
     * Retrieve a specific queue item.
     * @param  {string} requestedStepTitle
     * The descriptie name of the queue item to retrieve.
     * @return {Queue}
     */
    get (requestedStep) {
      // Get by Name
      let element = this.steps.filter(function (step) {
        return step.name === requestedStep
      })

      if (element.length === 1) {
        return element[0]
      }

      // Get by index
      element = this.steps.filter(function (step) {
        return step.number === requestedStep
      })

      if (element.length === 1) {
        return element[0]
      }
    }

    /**
     * @method remove
     * Remove a queue item by name or number.
     * @param  {string} requestedStepTitle
     * The descriptive name of the queue item to retrieve.
     * @return {Queue}
     * Returns the item that was removed.
     */
    remove (requestedStep) {
      if (this.processing) {
        return console.warn('Cannot add a step while processing.')
      }

      // Remove by name
      let element = this.steps.filter(function (step) {
        return step.name === requestedStep
      })

      if (element.length === 1) {
        this.steps = this.steps.filter(function (step) {
          return step.name !== requestedStep
        })

        this.emit('stepremoved', element[0])
        return element[0]
      }

      // Remove by ID
      element = this.steps.filter(function (step) {
        return step.number === requestedStep
      })

      if (element.length === 1) {
        this.steps = this.steps.filter(function (step) {
          return step.number !== requestedStep
        })

        this.emit('stepremoved', element[0])
        return element[0]
      }
    }

    /**
     * @method removeAt
     * Removes a queue item from the specific index.
     * @param  {number} requestedStepIndex
     * The queue index/number.
     * @return {Queue}
     * Returns the item that was removed.
     */
    removeAt (requestedStep) {
      if (this.processing) {
        return console.warn('Cannot add a step while processing.')
      }

      // Remove by index
      if (typeof requestedStep !== 'number') {
        return console.error('Failed to remove step: ' + requestedStep)
      }

      if (requestedStep < 0 || requestedStep >= this.steps.length) {
        return console.error('Step index ' + requestedStep + ' could not be found or does not exist.')
      }

      return this.steps.splice(requestedStep, 1)[0]
    }

    /**
     * @method reset
     * Resets all cancelled/skipped steps, essentially resetting the queue
     * to it's pre-aborted state.
     */
    reset () {
      if (this.processing) {
        return console.warn('Cannot reset a running queue. Abort or wait for the process to complete before resetting.')
      }

      // Refresh cancelled steps
      this.steps.forEach((step) => {
        step._skip = false
      })
    }

    /**
     * @method process
     * Run the queued processes in order.
     * @param {boolean} [sequential=false]
     * Set to `true` to run the queue items in a synchronous-like manner.
     * This will execute each method one after the other. Each method must
     * complete before the next is started.
     */
    process (sequential) {
      if (this.processing) {
        return console.warn('Cannot start processing (already running). Please wait for this process to complete before calling process() again.')
      }

      if (this.steps.length === 0) {
        return this.emit('complete')
      }

      const me = this
      this.processing = true
      this._cancel = false

      if (this.timeout !== null) {
        this.timer = setTimeout(function () {
          me.onTimeout()
        }, this.timeout)
      }

      this.sequential = typeof sequential === 'boolean' ? sequential : false
      if (!this.sequential) {
        for (var i = 0; i < this.steps.length; i++) {
          this.steps[i].run(this.mode)
        }
      } else {
        let queue = this.steps
        let listener = new NGN.EventEmitter()

        listener.on('stepcomplete', function () {
          if (queue.length > 0) {
            const currentTask = queue.shift()

            if (currentTask.skipped) {
              return listener.emit('stepcomplete')
            }

            currentTask.on('stepcomplete', function () {
              listener.emit('stepcomplete')
            })

            currentTask.on('stepstarted', function () {
              me.emit('stepstarted', currentTask)
            })

            currentTask.run(this.mode)
          } else {
            me.emit('complete')
          }
        })

        let currentStep = queue.shift()

        currentStep.on('stepcomplete', function () {
          listener.emit('stepcomplete')
        })

        currentStep.on('stepstarted', function () {
          me.emit('stepstarted', currentStep)
        })

        currentStep.run(this.mode)
      }
    }

    // Alias for process
    run () {
      this.process.apply(this, arguments)
    }

    /**
     * @method abort
     * Abort/cancel processing. This prevents further steps from processing.
     */
    abort () {
      this.emit('aborting')

      // Make sure the steps are skipped.
      this.each(function (step) {
        if (['completed', 'running', 'timedout'].indexOf(step.status) < 0 && !step.skipped) {
          step.skip()
        }
      })

      this.once('complete', () => {
        this.emit('aborted')
      })
    }

    /**
     * @method each
     * Apply a method to each step.
     * @param {function} method
     * @private
     */
    each (fn) {
      for (let i = 0; i < this.steps.length; i++) {
        fn(this.steps[i])
      }
    }

    // Alias for abort
    cancel () {
      this.abort.apply(this, arguments)
    }
  }

  NGNX.TaskRunner = TaskRunner
}
