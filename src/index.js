module.exports = function () {
  var reading = false
  var abort = false

  var i = 0
  var j = 0
  var last = 0
  var seen = []
  var ended = false
  var _cb
  var error
  var read
  var delegated = []
  var deferred = []

  function drain () {
    if (_cb) {
      var cb = _cb
      if (error) {
        _cb = null
        return cb(error)
      }
      if (Object.hasOwnProperty.call(seen, j)) {
        _cb = null
        var result = seen[j]
        delete seen[j]; j++
        cb(null, result)
      } else if (j >= last && ended) {
        _cb = null
        cb(ended)
      }
    }
  }

  function processDeferred () {
    while (deferred.length > 0) {
      var call = deferred.shift()
      lend(call.mapper, call.cb)
    }
  }

  function done (value, k) {
    return function (err, result) {
      if (err) {
        delegated.push({ value: value, k: k })
        return
      }

      seen[k] = result
      drain()
    }
  }

  function lend (mapper, cb) {
    if (!cb) cb = function () {}

    if (!read) {
      return cb(new Error('Stream is not connected yet'))
    }

    if (ended) {
      return cb(new Error('Stream is closed'))
    }

    if (delegated.length > 0) {
      var job = delegated.shift()
      cb(null)
      mapper(job.value, done(job.value, job.k))
      return
    }

    // If currently busy reading a value,
    // defer until read is available
    if (reading) {
      deferred.push({ mapper: mapper, cb: cb })
    }

    reading = true
    read(abort, function (end, value) {
      reading = false
      if (end) {
        last = i; ended = end
        cb(end)
        drain()
      } else {
        var k = i++
        cb(null)
        mapper(value, done(value, k))
      }
      processDeferred()
    })
  }

  function source (_abort, cb) {
    if (_abort) {
      read(ended = abort = _abort, function (err) {
        if (cb) return cb(err)
      })
    } else {
      _cb = cb
      drain()
    }
  }

  return {
    sink: function (_read) {
      read = _read
    },
    lend: lend,
    source: source
  }
}
