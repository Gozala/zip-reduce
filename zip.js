"use strict";

var accumulate = require("reducible/reduce")
var reduced = require("reducible/reduced")
var isReduced = require("reducible/is-reduced")
var isError = require("reducible/is-error")
var end = require("reducible/end")

var map = require("reducers/map")

var slicer = Array.prototype.slice

function makeAccumulator(side) {
  var other = side === "left" ? "right" : "left"
  return function accumulate(value, state) {
    var queue = state[side]
    var buffer = state[other]
    var dispatch = state.next
    // If consumer finished consumption, then notify stream.
    if (state.closed)  return state.result
    // If this is an end of this stream, close a queue to indicate
    // no other value will be queued.
    else if (value === end) {
      if (isReduced(state)) return state
      queue.closed = true
      // If queue is empty, dispatch end of stream.
      if (!queue.length) {
        dispatch(value, state.result)
        state.left = state.right = state.next = null
        state.closed = true
        state.result = reduced(result)
      }
    }
    else {
      queue.push(value)
      // If there is a buffered value on both streams shift and dispatch.
      if (buffer.length) {
        if (isError(buffer[0]))
          dispatch(buffer.shift(), state.result)
        else if (isError(queue[0]))
          dispatch(queue.shift(), state.result)

        if (buffer.length && queue.length) {
          var result = dispatch([
            state.left.shift(),
            state.right.shift()
          ], state.result)
          // If consumer is done consumption or if buffer is empty and closed
          // dispatch end, and mark stream ended to stop streams and queueing
          // values too.
          if (isReduced(result) || (buffer.closed && !buffer.length)) {
            // Dispatch end of stream and cleanup state attributes.
            dispatch(end, result)
            state.left = state.right = state.next = null
            state.closed = true
            state.result = reduced(result)
          } else {
            state.result = result
          }
        }
      }
    }
    return state
  }
}

var accumulateLeft = makeAccumulator("left")
var accumulateRight = makeAccumulator("right")

function Zip() {}
accumulate.define(Zip, function(zipped, next, start) {
  var state = { result: start, next: next, left: [], right: [] }
  accumulate(zipped.left, accumulateLeft, state)
  accumulate(zipped.right, accumulateRight, state)
})

function array(item) { return [item] }

function unite(value) {
  value[0].push(value[1])
  return value[0]
}

function concatzip(zipped, sequence) {
  return map(zip(zipped, sequence), unite)
}

function zip(left, right/*, ...rest*/) {
  switch (arguments.length) {
    case 1:
      return map(left, array)
    case 2:
      var value = new Zip()
      value.left = left
      value.right = right
      value.leftQueue = []
      value.rightQueue = []
      return value
    default:
      return slicer.call(arguments, 2).reduce(concatzip, zip(left, right))
  }
}

module.exports = zip
