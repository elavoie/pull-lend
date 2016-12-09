var pull = require('pull-stream')
var lend = require('../')

var lender = lend()

function minus (x, cb) {
  setTimeout(function () {
    cb(null, -x)
  }, 500)
}

function square (x, cb) {
  cb(null, x * x)
}

function err (x, cb) {
  cb(true)
}

// Prints 'Stream is not connected yet'
lender.lend(minus, function (err) {
  if (err) console.log(err.message)
})

// Prints 0,1,2,0,-1,4
pull(
  pull.count(2),
  pull.through(console.log),
  lender,
  pull.through(console.log),
  pull.drain()
)

lender.lend(minus)
lender.lend(err)
lender.lend(minus)
lender.lend(square)

// Prints 'closed'
setTimeout(function () {
  lender.lend(minus, function (err) {
    if (err) console.log('closed')
  })
}, 1000)
