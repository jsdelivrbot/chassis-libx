'use strict'

if (!NGN) {
  console.error('NGN not found.')
} else {
  if (!window.NGN.BUS) {
    console.warn('NGNX.Loader is not available because NGN.BUS was not found.')
  } else if (!NGN.NET) {
    console.warn('NGNX.Loader is not available because NGN.NET was not found.')
  } else {
    window.NGNX = window.NGNX || {}

    /**
     * @method NGNX.Loader
     * Load files a/synchronously and fire an event/callback when everything
     * is ready. Synchronous files are loaded first in a one-by-one manner.
     * Then asynchronous files are loaded in parallel at the same time. Once
     * **all** files are loaded, the callback or event is triggered.
     *
     * **Example Using Callback**
     * ```js
     * NGNX.Loader({
     *   sync: [
     *     './path/to/file1.js',
     *     './path/to/file2.js',
     *     './path/to/file3.js',
     *   ],
     *   async: [
     *     './path/to/file4.js',
     *     './path/to/file5.js',
     *     './path/to/file6.js',
     *   ],
     * }, function (loadedFiles) {
     *   // Do Something
     *   console.log(loadedFiles) // ['array', 'of', 'files']
     * })
     * ```
     * In this example, the series of actions is as follows:
     * 1. GET ./path/to/file1.js, then:
     * 1. GET ./path/to/file2.js, then:
     * 1. GET ./path/to/file3.js, then:
     * 1. GET ./path/to/file4.js & GET ./path/to/file5.js & GET ./path/to/file6.js, then:
     * 1. Do Something
     *
     * **Example Using Callback**
     * This does the same series of actions and provides the same functionality
     * as the callback example, except it uses the NGN.BUS to identify the end
     * of the load sequence.
     * ```js
     * NGNX.Loader({
     *   sync: [
     *     './path/to/file1.js',
     *     './path/to/file2.js',
     *     './path/to/file3.js',
     *   ],
     *   async: [
     *     './path/to/file4.js',
     *     './path/to/file5.js',
     *     './path/to/file6.js',
     *   ],
     * }, 'myfiles.loaded')
     *
     * NGN.BUS.once('myfiles.loaded', function (loadedFiles) {
     *   // Do Something
     *   console.log(loadedFiles) // ['array', 'of', 'files']
     * })
     * ```
     * The advantage of using the NGN.BUS method is the listener can exist in
     * a different file from the loader.
     * @param {object} cfg
     * @param {Function|string} callbackOrEvent
     * If a function is passed in, it will be run once all files are loaded. If
     * a event name is passed in, it will be triggered on the NGN.BUS once all
     * files are loaded. The callback receives a single array argument containing
     * all of the files loaded. This same argument is sent as a payload to the
     * event bus.
     * @fires load.sync
     * Triggered when a file is loaded synchronously. Event handlers will received
     * the name of the file as an argument.
     */
    window.NGNX.Loader = function (cfg, callback) {
      cfg = cfg || {}

      Object.defineProperties(this, {
        /**
         * @cfg {Array|String} sync
         * The files that will be loaded one-by-one. They are loaded in the order
         * they are specified.
         */
        async: NGN.public(cfg.async || []),

        /**
         * @cfg {Array|String} async
         * The files that will be loaded asynchronously. They are all loaded at
         * the same time. Even though this is asynchronous, if a callback is
         * provided to the Loader, it will not be run until all of the files
         * are loaded. The point of this method is to reduce time-to-load (parallel
         * downloads).
         */
        sync: NGN.public(cfg.sync || [])
      })

      this.async = Array.isArray(this.async) ? this.async : [this.async]
      this.sync = Array.isArray(this.sync) ? this.sync : [this.sync]

      let meta = {
        sync: this.sync,
        async: this.async
      }

      // Synchronous file loader
      const loadSync = function (files) {
        var currentFile = files.shift()
        NGN.NET.import(currentFile, function () {
          NGN.BUS.emit('load.sync', currentFile)

          if (files.length > 0) {
            loadSync(files)
          }
        })
      }

      // Load synchronous files first
      if (meta.sync.length > 0) {
        loadSync(meta.sync)
      }

      const responder = (imported, callback) => {
        if (typeof callback === 'function') {
          callback(this.sync.concat(imported))
        } else {
          NGN.BUS.emit(callback, this.sync.concat(imported))
        }
      }

      // Load asynchronous files
      if (this.async.length > 0) {
        NGN.NET.import(this.async, function (imported) {
          if (window.hasOwnProperty('fetch')) {
            responder(this.sync.concat(imported), callback)
          } else {
            // Force a slight delay to assure everything is loaded.
            // Double timeouts forces a "nextTick" type of action in some browsers.
            setTimeout(() => {
              setTimeout(() => {
                responder(this.sync.concat(imported), callback)
              }, 5)
            }, 0)
          }
        })
      } else {
        if (window.hasOwnProperty('fetch')) {
          responder(this.sync.concat(this.async), callback)
        } else {
          // Double timeouts forces a "nextTick" type of action in some browsers.
          setTimeout(() => {
            setTimeout(() => {
              responder(this.sync.concat(this.async), callback)
            }, 5)
          }, 0)
        }
      }
    }
  }
}
