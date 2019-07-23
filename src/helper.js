const uuid = require('uuid/v4')

const uuidChars = '0123456789'
    + 'abcdefghijklmnopqrstuvwxyz'
    + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

exports.uuid = () => {
    let id = uuid().replace(/-/g, '')
    let m = uuidChars.length
    let maxExponent = n => Math.floor(Math.log(n) / Math.log(m))
    let chunk = 8
    let mChunk = 1 + maxExponent(parseInt(Array(chunk).fill('f').join(''), 16))
    let numbers = [...Array(Math.floor(id.length / chunk))]
        .map((_, i) => parseInt(id.slice(i, i + chunk), 16))

    let result = numbers.map(n => {
        let result = ''

        for (let exp = maxExponent(n); exp >= 0; exp--) {
            let k = Math.floor(n / m ** exp)
            result += uuidChars[k]
            n -= k * m ** exp
        }

        return result.padStart(mChunk, '0')
    })

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
