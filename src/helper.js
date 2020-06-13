const {v4: uuid} = require('uuid')

const uuidChars =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

exports.encodeNumber = num => {
  let m = uuidChars.length
  let maxExponent = n => (n === 0 ? 0 : Math.floor(Math.log(n) / Math.log(m)))
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
  let mChunk =
    1 +
    exports.encodeNumber(parseInt(Array(chunk).fill('f').join(''), 16)).length
  let numbers = [...Array(Math.floor(id.length / chunk))].map((_, i) =>
    parseInt(id.slice(i, i + chunk), 16)
  )

  let result = numbers.map(n => exports.encodeNumber(n).padStart(mChunk, '0'))
  return result.join('')
}

exports.compare = (x, y) => (x < y ? -1 : +(x > y))

exports.compareMap = function compareMap(fn, cmp = exports.compare) {
  return (x, y) => cmp(fn(x), fn(y))
}

exports.compareLexically = (compareFn = exports.compare) => (arr1, arr2) => {
  let inner = i => {
    if (i >= arr1.length || i >= arr2.length) return arr1.length - arr2.length

    let compare = compareFn(arr1[i], arr2[i])
    return compare !== 0 ? compare : inner(i + 1)
  }

  return inner(0)
}
