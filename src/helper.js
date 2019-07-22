const uuid = require('uuid/v4')

exports.uuid = () => uuid()

exports.compare = (x, y) => x < y ? -1 : +(x > y)
exports.compareChange = (c1, c2) =>
    exports.compare(c1.timestamp, c2.timestamp)
    || exports.compare(c1.author, c2.author)

exports.sanitizeChange = change =>
    Object.keys(change).reduce((acc, key) => {
        if (key[0] !== '_') acc[key] = change[key]
        return acc
    }, {})
