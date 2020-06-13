const {compareLexically} = require('./helper')

exports.compare = function compare(pos1, pos2) {
  if (pos1 == null && pos1 == pos2) {
    return 0
  } else if (pos1 == null) {
    return -1
  } else if (pos2 == null) {
    return 1
  }

  return compareLexically(compareLexically())(pos1, pos2)
}

exports.equals = function equals(pos1, pos2) {
  return compare(pos1, pos2) === 0
}

exports.create = function create(author, beforePos, afterPos) {
  if (beforePos == null && afterPos == null) {
    return [[0, author]]
  }

  let [lastFragment1] = beforePos.slice(-1)
  let [lastFragment2] = afterPos.slice(-1)

  if (
    beforePos != null &&
    afterPos != null &&
    beforePos.length === afterPos.length &&
    lastFragment2[0] - lastFragment1[0] <= 1
  ) {
    return [...beforePos, [0, author]]
  }

  let anchorId =
    afterPos == null
      ? beforePos
      : beforePos == null
      ? afterPos
      : beforePos.length > afterPos.length
      ? beforePos
      : beforePos.length < afterPos.length
      ? afterPos
      : beforePos

  let [lastFragment] = anchorId.slice(-1)
  let diff = anchorId === beforePos ? 1 : -1

  return [...anchorId.slice(0, -1), [lastFragment[0] + diff, author]]
}
