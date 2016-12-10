var tape = require('tape')
var pull = require('pull-stream')
var lend = require('../')
var debug = require('debug')
var log = debug('test')

;(function () {
  var seed = 49734321
  function random () {
    // Robert Jenkins' 32 bit integer hash function.
    seed = ((seed + 0x7ed55d16) + (seed << 12)) & 0xffffffff
    seed = ((seed ^ 0xc761c23c) ^ (seed >>> 19)) & 0xffffffff
    seed = ((seed + 0x165667b1) + (seed << 5)) & 0xffffffff
    seed = ((seed + 0xd3a2646c) ^ (seed << 9)) & 0xffffffff
    seed = ((seed + 0xfd7046c5) + (seed << 3)) & 0xffffffff
    seed = ((seed ^ 0xb55a4f09) ^ (seed >>> 16)) & 0xffffffff
    return seed
  }

  Math.random = function () {
    return Math.abs(random() / 0x7fffffff)
  }

  Math.seed = function (s) {
    if (arguments.length === 1 && typeof s === 'number') {
      seed = s
    } else {
      seed = 49734321
    }
  }
})()

tape('Quick example', function (t) {
  var actual = []
  var expected = [0, 1, 2, -0, -1, 4]

  var lender = lend()

  function minus (err, x, cb) {
    if (err) t.false(err)

    setTimeout(function () {
      cb(null, -x)
    }, 500)
  }

  function square (err, x, cb) {
    if (err) t.false(err)

    cb(null, x * x)
  }

  function crash (err, x, cb) {
    if (err) t.false(err)

    cb(true)
  }

  // Prints 'Stream is not connected yet'
  lender.lend(function (err) {
    t.true(err, 'should be an error')
  })

  // Prints 0,1,2,-0,-1,4
  pull(
    pull.count(2),
    pull.through(function (x) { actual.push(x) }),
    lender,
    pull.through(function (x) { actual.push(x) }),
    pull.drain(null, function () {
      t.deepEqual(actual, expected)
    })
  )

  lender.lend(minus)
  lender.lend(crash)
  lender.lend(minus)
  lender.lend(square)

  lender.lend(function (err) {
    t.true(err)
    t.end()
  })
})

tape('Property 1', function (t) {
  var lender = lend()
  var read = 0

  pull(
    pull.count(1),
    pull.through(function (x) { read++ }),
    lender,
    pull.drain()
  )

  t.equal(read, 0)

  lender.lend(function borrower (err, value, cb) {
    t.false(err)
    t.equal(value, 0)
    t.equal(read, 1)
    t.end()
  })
})

tape('Property 2', function (t) {
  var lender = lend()
  var result = 0

  pull(
    pull.count(1),
    lender,
    pull.through(function (x) { result++ }),
    pull.collect(function (err, results) {
      t.false(err)
      t.equal(result, 2)
      t.deepEqual(results, [0, 1])
      t.end()
    })
  )

  t.equal(result, 0)

  lender.lend(function borrower (err, value, cb) {
    t.false(err)
    t.equal(value, 0)
    t.equal(result, 0)

    setTimeout(function () {
      cb(null, value)
    }, 100)
  })

  lender.lend(function borrower (err, value, cb) {
    t.false(err)
    t.equal(value, 1)
    t.equal(result, 0)

    setTimeout(function () {
      cb(null, value)
    }, 50)
  })

  lender.lend(function borrower (err) {
    t.true(err)
  })
})

tape('Property 3', function (t) {
  var lender = lend()
  var called = 0

  pull(
    pull.count(1),
    lender,
    pull.drain(null, function () {
      t.equal(called, 3)
      t.end()
    })
  )

  lender.lend(function borrower (err, value, cb) {
    t.false(err)
    called++
    cb(null, value)
  })

  lender.lend(function borrower (err, value, cb) {
    t.false(err)
    called++
    cb(null, value)
  })

  lender.lend(function borrower (err) {
    t.true(err)
    called++
  })
})

tape('Property 4', function (t) {
  // Making the random number generator deterministic,
  // although the interleaving resulting from setTimeout
  // is not...
  Math.seed()

  var lender = lend()
  var values = []
  values.length = 2000
  for (var i = 0; i < 2000; ++i) {
    values[i] = i
  }

  var done = 0
  function borrower (err, value, cb) {
    if (err) return t.false(err)

    setTimeout(function () {
      cb(null, value)
      done++
      if (done === 2000) {
        lender.lend(function (err) {
          t.true(err)
        })
      }
    }, Math.floor(Math.random() * 20))
  }

  pull(
    pull.values(values),
    lender,
    pull.collect(function (err, results) {
      t.false(err)
      t.deepEqual(results, values)
      t.end()
    })
  )

  // Randomly lends, with each borrower taking more or less
  // time to process
  values.forEach(function (x, i) {
    setTimeout(function () {
      lender.lend(borrower)
    }, Math.floor(Math.random() * 200))
  })
})

tape('Property 5', function (t) {
  // Making the random number generator deterministic,
  // although the interleaving resulting from setTimeout
  // is not...
  Math.seed()

  var lender = lend()
  var values = []
  values.length = 2000
  for (var i = 0; i < 2000; ++i) {
    values[i] = i
  }

  var done = 0
  function borrower (err, value, cb) {
    if (err) return t.false(err)

    setTimeout(function () {
      // ~10% chance of failing
      if (Math.floor(Math.random() * 10) === 1) {
        log('failed, starting a new borrower')
        cb(true)
        return lender.lend(borrower)
      }

      cb(null, value)
      done++
      if (done === 2000) {
        lender.lend(function (err) {
          t.true(err)
        })
      }
    }, Math.floor(Math.random() * 20))
  }

  pull(
    pull.values(values),
    lender,
    pull.collect(function (err, results) {
      t.false(err)
      t.deepEqual(results, values)
      t.end()
    })
  )

  // Randomly lends, with each borrower taking more or less
  // time to process
  values.forEach(function (x, i) {
    setTimeout(function () {
      lender.lend(borrower)
    }, Math.floor(Math.random() * 200))
  })
})

tape('Property 6.1', function (t) {
  var lender = lend()

  lender.lend(function (err) {
    t.true(err)
    t.end()
  })
})

tape('Property 6.2', function (t) {
  var lender = lend()
  pull(
    pull.count(),
    lender
  )

  lender.lend(function (err, value, cb) {
    t.false(err)
    t.equal(value, 0)
    cb(null, value)
  })

  lender.source(true)
  lender.lend(function (err) {
    t.true(err)
    t.end()
  })
})

tape('Property 6.3 (and 3.1 and 3.2)', function (t) {
  var lender = lend()
  var expected = [0, 1, 2]
  var borrowed = []
  var sourced = []
  var closed = false

  pull(
    pull.count(2),
    pull.through(function (x) { borrowed.push(x) }),
    lender,
    pull.through(function (x) { sourced.push(x) }),
    pull.collect(function (err, results) {
      closed = true
      t.false(err)
      t.deepEquals(results, expected)
      t.end()
    })
  )

  function borrower (err, value, cb) {
    if (sourced.length === 3) {
      t.true(err)
      t.deepEqual(borrowed, expected)
      t.deepEqual(sourced, expected)
      // Prop 3.2: Testing that all borrowers
      // return before closing at the same time
      t.false(closed)
      return
    }

    t.false(err)
    cb(null, value)
  }
  lender.lend(borrower)
  lender.lend(borrower)
  lender.lend(borrower)
  lender.lend(borrower)
})

tape('Property 7', function (t) {
  var lender = lend()
  var closed = false
  var done = 0
  var N = 100

  pull(
    // pull.count produces [0,N-1] inclusive
    pull.count(N - 1),
    lender,
    pull.drain(null, function () {
      closed = true
      t.equal(done, N + 1)
      t.end()
    })
  )

  function borrower (err, value, cb) {
    if (N === done++) {
      t.true(err)
      t.false(closed)
      return
    }

    if (err) t.false(err)
    cb(null, value)
  }

  for (var i = 0; i < N + 1; ++i) {
    lender.lend(borrower)
  }
})
