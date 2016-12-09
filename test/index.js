var tape = require('tape')
var pull = require('pull-stream')
var lend = require('../')

tape('Quick example', function (t) {
  var actual = []
  var expected = [0, 1, 2, -0, -1, 4]

  var lender = lend()

  function minus (x, cb) {
    setTimeout(function () {
      cb(null, -x)
    }, 100)
  }

  function square (x, cb) {
    cb(null, x * x)
  }

  function err (x, cb) {
    cb(true)
  }

  // Prints 'Stream is not connected yet'
  lender.lend(minus, function (err) {
    t.true(err, 'should be an error')
  })

  // Prints 0,1,2,-0,-1,4
  pull(
    pull.count(2),
    pull.through(function (x) { actual.push(x) }),
    lender,
    pull.through(function (x) { actual.push(x) }),
    pull.drain()
  )

  lender.lend(minus, t.false)
  lender.lend(err, t.false)
  lender.lend(minus, t.false)
  lender.lend(square, t.false)

  setTimeout(function () {
    lender.lend(minus, t.true)
    t.deepEqual(actual, expected)
    t.end()
  }, 200)
})
