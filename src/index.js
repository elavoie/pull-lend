var debug = require('debug')

module.exports = function () {
  var log = debug('pull-lend')
  var reading = false
  var abort = false

  var i = 0 // value read
  var j = 0 // value sourced
  var last = 0
  var seen = [] // buffer to reorder results
  var ended = false // whether there are still values to read
  var _cb
  var read
  var delegated = [] // values delegated to another borrower
  var deferred = [] // borrowers deferred to complete later
  var lent = 0 // values lent not returned yet
  var pending = 0 // values returned not yet sourced

  function drain () {
    log('drain')

    if (_cb) {
      var cb = _cb
      // Prop 4: Ensure the results are returned in the order
      // the values were read
      if (Object.hasOwnProperty.call(seen, j)) {
        _cb = null
        var result = seen[j]
        delete seen[j]; j++
        pending--
        cb(null, result)
      } else if (j >= last && ended) {
        _cb = null

        // Prop 3:
        // Prop 6.3: We are done sinking results,
        // make sure there are no pending borrowers
        processAllDeferred()

        // Propagate closing event
        cb(ended)
      }
    } else if (j >= last && ended) {
      // Prop 3:
      // Prop 6.3: We are done sinking results,
      // make sure there are no pending borrowers
      processAllDeferred()
    }
  }

  function processOneDeferred () {
    log('processOneDeferred')

    if (deferred.length > 0) {
      lend(deferred.shift())
    }
  }

  function processAllDeferred (abort) {
    log('processAllDeferred(' + deferred.length + ')')

    if (deferred.length > 0) {
      var _deferred = deferred.slice(0)
      deferred = []

      if (abort) {
        _deferred.forEach(function (borrower) {
          borrower(abort)
        })
      } else {
        _deferred.forEach(lend)
      }
    }
  }

  function result (value, k) {
    var called = false
    return function (err, result) {
      if (called) {
        log('result(' + err + (err ? '' : ',' + result) + '), called multiple times, ignoring this call')
        drain()
        return
      }

      log('result(' + err + (err ? '' : ',' + result) + ')')
      called = true
      lent--

      if (err) {
        log('failed, delegating value ' + k + ': ' + value)

        // Prop 5: the borrower failed, delegate the value
        // to another borrower
        delegated.push({ value: value, k: k })
        return processOneDeferred()
      }

      log('received result ' + k + ': ' + result)

      // Prop 4: buffer the result until we can source it
      pending++
      seen[k] = result
      drain()
    }
  }

  function canBorrow (borrower) {
    if (!read) {
      log('not connected')

      // Prop 6.1: the lender is not connected yet
      borrower(new Error('lender is not connected yet'))
      return false
    }

    if (ended && j >= last) {
      log('closed')

      // Prop 6.3: all results have been sourced
      borrower(true)
      return false
    }

    // If currently busy reading a value and no value is available,
    // defer until read is available again
    if (reading && delegated.length === 0) {
      log('busy reading, deferring')

      // Prop 3: ensure the borrower is eventually called back
      deferred.push(borrower)
      return false
    }

    // Prop 3 :
    // Prop 6.3:
    // The source has no more values and some values are still being borrowed.
    // The current borrowers may still fail and not produce results, so defer
    if (ended && j < last) {
      log('source has ended but not all results are in, deferring')

      deferred.push(borrower)
      return false
    }

    return true
  }

  function readSourceValue (borrower) {
    log('reading')

    reading = true

    // Prop 3:
    deferred.push(borrower)

    read(abort, function (end, value) {
      reading = false
      log('reading done')

      if (end) {
        log('source ended')
        last = i; ended = end
        return drain()
      }

      var k = i++
      log('delegating value ' + k + ': ' + value)
      delegated.push({value: value, k: k})

      // Prop 3: Ensure all borrowers that called lend while
      // we were reading are processed
      processAllDeferred()
    })
  }

  function lend (borrower) {
    log('lend([' + (typeof borrower) + '])')

    // Prop 5: relend the value of a previously missing result
    if (delegated.length > 0) {
      var job = delegated.shift()
      log('relending value ' + job.k + ': ' + job.value)
      lent++
      borrower(null, job.value, result(job.value, job.k))
      return
    }

    if (!canBorrow(borrower)) return

    // Prop 1: read a new value, triggered by a lend
    readSourceValue(borrower)
  }

  function state () {
    return {
      reading: reading,
      aborted: abort,
      ended: ended,
      last: last,
      readNb: i,
      sourcedNb: j,
      lentNb: lent,
      pendingNb: pending,
      delegatedNb: delegated.length,
      deferredNb: deferred.length
    }
  }

  return {
    sink: function (_read) {
      read = _read
      log('connected')
    },
    lend: lend,
    source: function source (_abort, cb) {
      log('source(' + _abort + ',[' + (typeof cb) + '])')

      if (_abort) {
        read(ended = abort = _abort, function (err) {
          // Prop 6.2: The lender has been closed
          // by the source
          processAllDeferred(err)

          if (_cb) _cb(err) // Make sure the pending callback completes
          if (cb) return cb(err)
        })
        return
      }

      _cb = cb
      drain()
    },
    _state: state
  }
}
