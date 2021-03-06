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

exports.compareLexically = (compareFn = exports.compare) => (arr1, arr2) => {
    let inner = i => {
        if (i >= arr1.length || i >= arr2.length) return arr1.length - arr2.length

        let compare = compareFn(arr1[i], arr2[i])
        return compare !== 0 ? compare : inner(i + 1)
    }

    return inner(0)
}

exports.wrapProperties = (data, properties, fn) => {
    return Object.keys(data).reduce((acc, property) => {
        if (
            properties.includes(property)
            && data[property] != null
            && data[property][0] != null
        ) {
            acc[property] = [fn(data[property][0])]
        } else {
            acc[property] = data[property]
        }

        return acc
    }, {})
}

exports.diffString = (from, to, fromStart = 0, toStart = 0) => {
    from = Array.from(from)
    to = Array.from(to)

    if (toStart >= to.length && fromStart >= from.length) {
        return {deletions: [], insertions: []}
    } else if (toStart >= to.length) {
        return {
            deletions: [...Array(from.length - fromStart)].map((_, i) => fromStart + i),
            insertions: []
        }
    } else if (fromStart >= from.length) {
        return {
            deletions: [],
            insertions: [{at: fromStart, insert: to.slice(toStart).join('')}],
        }
    } else if (from[fromStart] === to[toStart]) {
        return exports.diffString(from, to, fromStart + 1, toStart + 1)
    }

    let deletionResult = exports.diffString(from, to, fromStart + 1, toStart)
    let insertionResult = exports.diffString(from, to, fromStart, toStart + 1)
    let complexity = changes => changes.deletions.length
        + changes.insertions.reduce((sum, {insert}) => sum + insert.length, 0)

    if (complexity(deletionResult) < complexity(insertionResult)) {
        deletionResult.deletions.push(fromStart)
        return deletionResult
    } else {
        if (insertionResult.insertions.length > 0 && insertionResult.insertions[0].at === fromStart) {
            insertionResult.insertions[0].insert = to[toStart] + insertionResult.insertions[0].insert
        } else {
            insertionResult.insertions.unshift({at: fromStart, insert: to[toStart]})
        }

        return insertionResult
    }
}
