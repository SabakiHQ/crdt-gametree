const uuid = require('uuid/v4')

const uuidChars = '0123456789'
    + 'abcdefghijklmnopqrstuvwxyz'
    + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

exports.encodeNumber = num => {
    let m = uuidChars.length
    let maxExponent = n => n === 0 ? 0 : Math.floor(Math.log(n) / Math.log(m))
    let result = ''

    for (let exp = maxExponent(num); exp >= 0; exp--) {
        let k = Math.floor(num / m ** exp)
        result += uuidChars[k]
        num -= k * m ** exp
    }

    return result
}

exports.uuid = () => {
    let id = uuid().replace(/-/g, '')
    let chunk = 8
    let mChunk = 1 + exports.encodeNumber(parseInt(Array(chunk).fill('f').join(''), 16)).length
    let numbers = [...Array(Math.floor(id.length / chunk))]
        .map((_, i) => parseInt(id.slice(i, i + chunk), 16))

    let result = numbers.map(n => exports.encodeNumber(n).padStart(mChunk, '0'))
    return result.join('')
}

exports.compare = (x, y) => x < y ? -1 : +(x > y)
exports.compareChange = (c1, c2) =>
    exports.compare(c1.timestamp, c2.timestamp)
    || exports.compare(c1.author, c2.author)

exports.sanitizeChange = change =>
    Object.keys(change).reduce((acc, key) => {
        if (key[0] !== '_') acc[key] = change[key]
        return acc
    }, {})
