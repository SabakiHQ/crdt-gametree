const EventEmitter = require('events')
const ImmutableGameTree = require('@sabaki/immutable-gametree')
const fractionalPosition = require('./fractionalPosition')
const {encodeNumber, uuid, compareMap, compareLexically} = require('./helper')

const rootId = '02JXJgZ01FqtDf03fvq9F00qN3m7'

class GameTree extends EventEmitter {
  constructor({authorId, getId} = {}) {
    this.authorId = authorId == null ? uuid() : authorId
    this.timestamp = [0]
    this.getId =
      getId || (i => () => [encodeNumber(++i), this.authorId].join('-'))(0)

    let root = {
      meta: {
        position: null,
        positionTimestamp: [],
        removed: false,
        removedTimestamp: [],
        root: true,
        rootTimestamp: [],
      },
      data: {},
      dataIds: {},
      parentId: null,
      childIds: [],
    }

    this._nodes = {
      [rootId]: root,
    }

    this.rootId = rootId
    this.rootTimestamp = []
    this.pendingChanges = []
  }

  _tick() {
    this.timestamp = [this.timestamp[0] + 1, this.authorId]
    return this.timestamp
  }

  get(id) {
    let node = this._nodes[id]
    if (node == null || node.meta.removed) return null

    return {
      id,
      data: node.data,
      parent() {
        return this.rootId === id ? null : this.get(node.parentId)
      },
      children() {
        return node.childIds
          .map(id => this._nodes[id])
          .filter(node => !node.meta.removed)
          .sort(
            compareMap(node => node.meta.position, fractionalPosition.compare)
          )
          .map(node => this.get(node.id))
      },
    }
  }

  getHash() {
    return this.timestamp.join('-')
  }

  toJSON() {
    return {
      nodes: this._nodes,
      rootId: this.rootId,
      rootTimestamp: this.rootTimestamp,
      pendingChanges: this.pendingChanges,
    }
  }

  // Mutations

  appendNode(parentId, data) {
    let id = this.getId()
    let success = this.UNSAFE_appendNodeWithId(parentId, id, data)
    if (!success) return null

    return id
  }

  UNSAFE_appendNodeWithId(parentId, id, data, position = null) {
    if (this._nodes[id] != null) return false

    let parentNode = this.get(parentId)
    if (parentNode == null) return false

    let timestamp = this._tick()
    let siblings = parentNode.children()

    let maxSiblingPosition = siblings
      .slice(-1)
      .map(sibling => this._nodes[sibling.id].meta.position)[0]

    position =
      position ||
      fractionalPosition.create(this.authorId, maxSiblingPosition, null)

    this._nodes[id] = {
      meta: {
        position,
        positionTimestamp: [],
        removed: false,
        removedTimestamp: [],
        root: false,
        rootTimestamp: [],
      },
      data,
      dataIds: Object.keys(data).reduce((acc, key) => {
        acc[key] = data[key].map((_, i) => i.toString())
        return acc
      }, {}),
      parentId,
      childIds: [],
    }

    this._nodes[parentId].childIds.push(id)

    this.emit('change', {
      type: 'appendNode',
      timestamp,
      data: {
        id,
        parentId,
        data,
        position,
      },
    })

    return true
  }
}

module.exports = GameTree
