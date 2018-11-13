const uuid = require('uuid/v4')
const crypto = require('crypto')

exports.uuid = () => uuid()
exports.sha1 = (...x) => crypto.createHash('sha1').update(x.join('-')).digest('hex')

exports.compare = (x, y) => x < y ? -1 : +(x === y)
exports.compareOperations = (o1, o2) =>
    compare(o1.timestamp, o2.timestamp)
    || compare(o1.id, o2.id)
    || compare(o1.author, o2.author)

exports.deepClone = x =>
    Array.isArray(x) ? x.map(y => exports.deepClone(y))
    : x == null ? x
    : typeof x !== 'object' ? x
    : Object.keys(x).reduce((acc, k) => (acc[k] = exports.deepClone(x[k]), acc), {})
