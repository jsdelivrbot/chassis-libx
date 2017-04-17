'use strict'

var test = require('tape')

test('NGNX.REF Sanity Check', function (t) {
  t.ok(NGNX.hasOwnProperty('REF'), 'NGNX.REF is not defined.')
  t.ok(typeof NGNX.REF === 'object', 'NGNX.REF is a singleton.')
  t.ok(NGNX.hasOwnProperty('ref'), 'NGNX.ref alias is not defined.')
  t.end()
})

test('NGNX.REF Basic Functionality', function (t) {
  var p = document.createElement('span')
  var hr = document.createElement('hr')
  var sel = '#test2'

  hr.setAttribute('id', 'test2')
  p.appendChild(hr)

  document.body.appendChild(p)

  var x = NGNX.REF.create('test', sel)

  t.ok(NGNX.ref.test !== undefined, 'NGNX.REF.create() creates a reference.')
  t.ok(x !== undefined, 'NGNX.REF.create() returns a reference object.')
  t.ok(typeof NGNX.ref.test.on === 'function', 'NGNX.REF.<name>.on aliases addEventListener.')

  NGNX.REF.test.once('click', function () {
    t.pass('NGNX.ref.<name>.on alias successfully relays events.')
    t.ok(document.body.querySelector('#test2') !== null, '#test2 should exist')

    // Remove the reference
    t.doesNotThrow(function () {
      NGNX.REF.remove('test')

      t.ok(document.body.querySelector('#test2') !== null, '#test2 element should not be removed after removal of reference.')

      NGNX.REF.create('test', sel)

      t.ok(document.body.querySelector('#test2') !== null, '#test2 element should exist after creation.')

      t.doesNotThrow(function () {
        console.log(NGNX.REF.test)

        NGNX.REF.test.element.classList.add('dummyCSS')

        t.ok(NGNX.REF.test.element.classList.contains('dummyCSS'), 'Element attribute set successfully.')
      }, 'Setting a basic DOM property does not throw an error.')

      NGNX.REF.remove('test') // Cleanup

      t.end()
    }, 'NGNX.REF.remove("test") should not throw an error')
  })

  var element = document.querySelector(sel)

  element.click()
})

test('NGNX.REF Enhanced Event Management', function (t) {
  var sel = '#test2'
  var element = document.querySelector(sel)

  NGNX.REF.create('test', sel)
  NGNX.REF.test.on({
    click: function () {
      t.pass('Event pooling recognized.')

      NGN.BUS.emit('_pool_')
    },

    mouseover: function () {}
  })

  NGNX.REF.test.once('click', function () {
    t.pass('One-time events fire properly.')
    NGN.BUS.emit('_one-off_')
  })

  NGN.BUS.funnelOnce(['_one-off_', '_pool_'], 'done')
  NGN.BUS.once('done', function () {
    t.end()
  })

  element.click()
})

test('NGNX.REF Multi-Element Selectors (Basic)', function (t) {
  document.body.insertAdjacentHTML('beforeend', '<span class="dex">a</span><span class="dex">b</span>')

  NGNX.REF.create('group', 'span.dex')

  NGN.BUS.thresholdOnce('counted', 2, 'done')

  NGNX.REF.group.on('click', function () {
    NGN.BUS.emit('counted')
  })

  NGN.BUS.once('done', function () {
    t.pass('One event handler applied to multiple elements successfully.')
    t.end()
  })

  var elements = document.querySelectorAll('.dex')

  for (var i = 0; i < elements.length; i++) {
    elements[i].click()
  }
})

test('NGNX.REF.Multi-Element Selectors (Complex)', function (t) {
  document.body.insertAdjacentHTML('beforeend', '<div id="root"><div></div><div></div><div id="ancestoral"> <div id="ignored"></div><div> <div>test</div></div><div> <div class="findme"></div><div> <span> <div class="findme"> </span> </div></div><div class="findme"></div></div><div></div></div>')

  var elements = NGN.slice(document.querySelectorAll('.findme'))

  NGNX.REF.create('complex', '.findme')
  NGN.BUS.thresholdOnce('counted', elements.length, 'done')

  NGNX.REF.complex.on('click', function () {
    NGN.BUS.emit('counted')
  })

  NGN.BUS.once('done', function () {
    t.pass('One event handler applied to multiple complexly nested elements successfully.')
    t.end()
  })

  for (var i = 0; i < elements.length; i++) {
    elements[i].click()
  }
})

test('NGNX.REF.Multi-Element Selectors (Complex - No Proxy)', function (t) {
  document.body.insertAdjacentHTML('beforeend', '<div id="root"><div></div><div></div><div id="ancestoral"> <div id="ignored"></div><div> <div>test</div></div><div> <div class="findme"></div><div> <span> <div class="findme"> </span> </div></div><div class="findme"></div></div><div></div></div>')

  var elements = NGN.slice(document.querySelectorAll('.findme'))

  // NGNX.REF.disableProxy()

  NGNX.REF.create('complex', '.findme')
  NGN.BUS.thresholdOnce('counted', elements.length, 'done')

  NGNX.REF.complex.on('click', function () {
    NGN.BUS.emit('counted')
  })

  NGN.BUS.once('done', function () {
    t.pass('One event handler applied to multiple complexly nested elements successfully without using ES2015 Proxy.')
    // NGNX.REF.enableProxy()
    t.end()
  })

  for (var i = 0; i < elements.length; i++) {
    elements[i].click()
  }
})

test('NGNX.REF Subelement find()', function (t) {
  document.body.insertAdjacentHTML('beforeend', '<div id="subfindroot"><div></div><div></div><div id="ancestoral"> <div id="ignored"></div><div> <div>test</div></div><div> <div class="findme"></div><div> <span> <div class="findme"> </span> </div></div><div class="findme"></div></div><div></div></div>')

  // var elements = NGN.slice(document.querySelectorAll('.findme'))
  NGNX.REF.create('subroot', '#subfindroot')
  t.ok(NGN.typeof(NGNX.REF.find('#subfindroot')) === NGN.typeof(NGNX.REF.subroot), 'Global find works.')
  t.ok(NGNX.REF.subroot.find('.findme').length === 3, 'Selector find capability works.')
  t.ok(NGNX.REF.find('#subfindroot').find('.findme').length === 3, 'Chained find methods return the appropriate elements.')

  t.end()
})

test('NGNX.REF Property Reference', function (t) {
  document.body.insertAdjacentHTML('beforeend', '<div id="replaceme">original text</div>')
  // NGNX.REF.disableProxy()
  NGNX.REF.create('replacer', '#replaceme')
  NGNX.REF.replacer.element.innerHTML = 'replaced'
  t.ok(NGNX.REF.replacer.element.innerHTML === 'replaced', 'Replaced innerHTML of a reference.')

  t.doesNotThrow(function () {
    NGNX.REF.replacer.element.donuts = 'mmm'
  }, 'Setting inconsequential attribute does not throw error.')

  NGNX.REF.replacer.element.innerHTML = '<div><span>yo</span><span>dude</span></div>'

  NGN.BUS.thresholdOnce('ref.done', 2, 'ref.complete')
  NGN.BUS.once('ref.complete', function () {
    t.pass('forEach method recognized on grouped reference.')
    t.end()
  })

  NGNX.REF.replacer.find('span').each(function (ref) {
    NGN.BUS.emit('ref.done')
  })
})

test('NGNX.REF.eachClassList', function (t) {
  let html = '<div class="multitest"><span>A</span><span>B</span><span>C</span></div>'
  document.body.insertAdjacentHTML('beforeend', html)

  NGNX.REF.create('mtest', '.multitest span')

  t.ok(NGNX.REF.mtest.length === 3, 'Proper number of elements recognized.')

  NGNX.REF.mtest.eachClassList.add('mtest')

  t.ok(document.querySelectorAll('.multitest .mtest').length === 3, 'Each element received a classList update.')

  NGNX.REF.mtest.eachClassList.replace('mtest', 'somethingelse')

  t.ok(document.querySelectorAll('.multitest .somethingelse').length === 3, 'Each element received a classList replace() update.')

  NGNX.REF.mtest.eachClassList.toggle('blah')

  t.ok(document.querySelectorAll('.multitest .blah').length === 3, 'Each element received a classList toggle() update.')

  NGNX.REF.mtest.eachClassList.remove('somethingelse')

  t.ok(document.querySelectorAll('.multitest .somethingelse').length === 0, 'Each element received a classList delete() update.')

  t.end()
})

test('NGNX.REF JSON Data', function (t) {
  NGNX.REF.create('group', 'span.dex')
  NGNX.REF.create('test', '#test2')

  t.ok(typeof NGNX.REF.json === 'object', 'JSON object is available for introspection.')
  t.ok(
    NGNX.REF.json.hasOwnProperty('group') &&
    NGNX.REF.json.hasOwnProperty('test') &&
    NGNX.REF.json.group === 'span.dex' &&
    NGNX.REF.json.test === '#test2', 'References are properly represented as a JSON object.')
  t.end()
})
