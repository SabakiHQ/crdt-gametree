const ImmutableGameTree = require('@sabaki/immutable-gametree')
const {encodeNumber, uuid} = require('./helper')

const rootId = '02JXJgZ01FqtDf03fvq9F00qN3m7'

class GameTree {
  constructor({id, getId, merger, root} = {}) {
    this.id = id == null ? uuid() : id
    this.timestamp = 0
    this.getId = getId || (i => () => [encodeNumber(++i), this.id].join('-'))(0)

    if (root == null) {
      root = {id: rootId, data: {}, parentId: null, children: []}
    } else if (root.id == null) {
      root.id = rootId
    }

    this.base = new ImmutableGameTree({getId: this.getId, merger, root})
    this.merger = this.base.merger
    this.root = this.base.root

    this._gameTree = this.base
  }
}

module.exports = GameTree
