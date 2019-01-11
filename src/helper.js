const uuid = require('uuid/v4')
const rusha = require('rusha')

exports.uuid = () => uuid()
exports.sha1 = (...x) => rusha.createHash().update(JSON.stringify(x)).digest('hex')

exports.compare = (x, y) => x < y ? -1 : +(x > y)
exports.compareChange = (c1, c2) =>
    exports.compare(c1.timestamp, c2.timestamp)
    || exports.compare(c1.id, c2.id)

exports.sanitizeChange = change => {
    let result = Object.assign({}, change)
    delete result.snapshot
    return result
}
