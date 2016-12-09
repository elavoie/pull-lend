Lends one value at a time from a stream. Re-lends in case of errors.

A client borrows a value, processes it, and returns the result to the stream
later. 

* Supports multiple concurrent borrowers
* Produces results in the order in which the sink reads the values
* If a borrower returns an error rather than a result, the value is lent to
  another borrower until a result is returned

Useful for delegating processing to a dynamic number of concurrent,
cooperative, but unreliable clients.

Quick Example
=============

    var pull = require('pull-stream')
    var lend = require('pull-lend')

    var lender = lend()

    function minus (x, cb) {
      setTimeout(function () {
        cb(null, -x)
      }, 500)
    }

    function square(x, cb) {
      cb(null, x*x)
    }

    function err (x, cb) {
      cb(true)
    }

    // Prints 'Stream is not connected yet'
    lender.lend(minus, function (err) {
      if (err) console.log(err.message)
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
    lender.lend(err)
    lender.lend(minus)
    lender.lend(square)

    // Prints 'closed'
    setTimeout(function () {
      lender.lend(minus, function (err) {
        if (err) console.log('closed')
      })
    }, 1000)

Signature 
=========

The following signature follows the [js module signature
syntax](https://github.com/elavoie/js-module-signature-syntax) and conventions.
All callbacks ('cb') have the '(err, value)' signature.

    lender: () =>
    {
        sink: (read: (abort, cb)),
        lend: (borrower: (value, cb), ?lendCb: (err)),
        source: (abort, cb)
    }


Properties 
==========

1. Each read is first initiated by a lend (but each lend does not necessarily imply a read).
2. Multiple values may be lent concurrently by calling lend multiple times.
3. The borrower may never be called if the stream is not connected or has closed.
   In these cases, the optional lendCB will complete with an error. If the
   borrower can successfully be called, lendCb will complete with null.
4. The source produces results in the order in which the values were read by the sink.
5. If a borrower returns an error, its input value will be given to another borrower later.
