const uuid = require('uuid/v4')
const crypto = require('crypto')

exports.uuid = () => uuid()
exports.sha1 = (...x) => crypto.createHash('sha1').update(x.join('-')).digest('hex')

exports.compare = (x, y) => x < y ? -1 : +(x !== y)
exports.compareOperations = (o1, o2) =>
    exports.compare(o1.timestamp, o2.timestamp)
    || exports.compare(o1.id, o2.id)
