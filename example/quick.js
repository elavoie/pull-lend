var pull = require('pull-stream')
var lend = require('../')

var lender = lend()

function minus (err, x, cb) {
  if (err) throw err

  setTimeout(function () {
    cb(null, -x)
  }, 500)
}

function square (err, x, cb) {
  if (err) throw err

  cb(null, x * x)
}

function crash (err, x, cb) {
  if (err) throw err

  cb(true)
}

// Prints 'lender is not connected yet'
lender.lend(function (err) {
  console.log(err.message)
})

// Prints 0,1,2,-0,-1,4
pull(
  pull.count(2),
  pull.through(console.log),
  lender,
  pull.through(console.log),
  pull.drain()
)

lender.lend(minus)
lender.lend(crash)
lender.lend(minus)
lender.lend(square)

// Prints 'closed with: true'
lender.lend(function (err) {
  if (err) console.log('closed with: ' + err)
})
