[![Build Status](https://travis-ci.org/elavoie/pull-lend.svg?branch=master)](https://travis-ci.org/elavoie/pull-lend)

# pull-lend

Lends one value at a time from a stream. Re-lends in case of errors.

A client borrows a value, processes it, and returns the result to the stream
later. 

* Supports multiple concurrent borrowers
* Produces results in the order in which the sink reads the values
* If a borrower returns an error rather than a result, the value is transparently lent to another borrower, continuing until a result is returned

Useful for delegating processing to a dynamic number of concurrent,
cooperative, but unreliable clients.

Quick Example
=============

    var pull = require('pull-stream')
    var lend = require('pull-lend')

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

Signature 
=========

The following signature follows the [js module signature
syntax](https://github.com/elavoie/js-module-signature-syntax) and conventions.
All callbacks ('cb') have the '(err, value)' signature.

    lend: () =>
    lender: {
        sink: (read: (abort, cb)),
        lend: (borrower: (err, value, cb)),
        source: (abort, cb)
    }


Properties 
==========

1. Each read is first initiated by a lend (but each lend does not necessarily 
   imply a read).
2. Multiple values may be lent concurrently by calling lend multiple times.
3. Once lend has been called:  
  3.1 the borrower will eventually be called either with a value or an err;  
  3.2 all borrowers will be called before the stream closes.
4. The source produces results in the order in which the values were read by
   the sink.
5. If a borrower returns an error, its input value will be given to another
   borrower later.
6. When the borrower is called, err is truthy iff:  
  6.1 the lender is not connected yet;  
  6.2 the lender was closed by the source;  
  6.3 all available values have been borrowed and  all results have been sourced.
7. For N values available for borrowing, it takes N successful borrowers and 1
   extra lend call to close the lender.
8. If a borrower calls its `cb` multiple times, all subsequent calls after the first will be ignored.

Debugging
=========

You can obtain a trace of the internal events of the module by activating the logging using the `DEBUG=pull-lend` environment variable (see [debug](http://npmjs.org/debug)).

You can also obtain the internal state of the module at a specific point in time by calling the `_state()` method. It returns an object with the following properties:
````
    {
      reading: Boolean,    // Currently reading a value from upstream
      aborted: Boolean,    // Aborted from downstream
      ended: Boolean,      // Upstream ended
      last: Number,        // Last index of the stream (0 until ended = true)
      readNb: Number,      // Number of values read from upstream
      sourcedNb: Number,   // Number of values sourced downstream
      lentNb: Number,      // Number of values lent that have not returned yet
      pendingNb: Number,   // Number of values returned not yet sourced
      delegatedNb: Number, // Number of values returned because of an error,
                           // awaiting to be lent again
      deferredNb: Number   // Number of borrowers waiting for a value
    }

````

The module maintains the following invariant:

````
    readNb - sourcedNb = lentNb + pendingNb + delegatedNb
````

The output of the `_state()` method should not be relied on for regular operations because it depends on the implementation of the module and may change in the future.
