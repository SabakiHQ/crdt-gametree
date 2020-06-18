const EventEmitter = require('events')
const fractionalPosition = require('./fractionalPosition')
const {
  encodeNumber,
  uuid,
  max,
  compareMap,
  compareLexically,
} = require('./helper')

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
      props: {},
      propsMeta: {},
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
      props() {
        return Object.keys(node.props).reduce((acc, key) => {
          acc[key] = [
            ...new Set(
              node.props[key].filter((_, i) => !node.propsMeta[key][i].removed)
            ),
          ]

          if (acc[key].length === 0) {
            delete acc[key]
          }

          return acc
        }, {})
      },
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

  toJSON() {
    return {
      nodes: this._nodes,
      rootId: this.rootId,
      rootTimestamp: this.rootTimestamp,
      pendingChanges: this.pendingChanges,
    }
  }

  // Mutations

  appendNode({parentId, id = null, position = null, props = {}}) {
    if (id == null) id = this.getId()
    if (this._nodes[id] != null) return null

    let parentNode = this.get(parentId)
    if (parentNode == null) return null

    let siblings = parentNode.children()
    let timestamp = this._tick()
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
      props,
      propsMeta: Object.keys(props).reduce((acc, key) => {
        acc[key] = props[key].map(_ => ({
          id: this.getId(),
          removed: false,
        }))
        return acc
      }, {}),
      parentId,
      childIds: [],
    }

    this._nodes[parentId].childIds.push(id)

    this.emit('change', {
      type: 'appendNode',
      timestamp,
      data: {parentId, id, position, props},
    })

    return id
  }

  repositionNode({id, position}) {
    let node = this._nodes[id]
    if (node == null) return false

    let timestamp = this._tick()

    Object.assign(node.meta, {
      position,
      positionTimestamp: timestamp,
    })

    this.emit('change', {
      type: 'repositionNode',
      timestamp,
      data: {id, position},
    })

    return true
  }

  shiftNode({id, direction}) {
    if (!['left', 'right', 'main'].includes(direction)) return false

    let node = this._nodes[id]
    if (node == null) return false

    let parent = this.get(node.parentId)
    if (parent == null) return false

    let beforePosition = null
    let afterPosition = null

    if (direction !== 'main') {
      let index = parent.children.findIndex(child => child.id === id)
      let step = direction === 'left' ? -1 : 1
      if (index + step < 0 || index + step >= parent.children.length)
        return false
      ;[beforePosition, afterPosition] = (step > 0
        ? [step, step + 1]
        : [step - 1, step]
      )
        .map(step => parent.children[step])
        .map(sibling => this._nodes[sibling.id].meta.position)
    } else {
      if (parent.children[0].id === id) return false

      afterPosition = this._nodes[parent.children[0].id].meta.position
    }

    let newPosition = fractionalPosition.create(
      this.authorId,
      beforePosition,
      afterPosition
    )

    return this.repositionNode({id, position: newPosition})
  }

  removeNode({id}) {
    let node = this._nodes[id]
    if (node == null || node.removed) return false

    let timestamp = this._tick()

    Object.assign(node.meta, {
      removed: true,
      removedTimestamp: timestamp,
    })

    this.emit('change', {
      type: 'removeNode',
      timestamp,
      data: {id},
    })

    return true
  }

  restoreNode({id}) {
    let node = this._nodes[id]
    if (node == null || !node.removed) return false

    let timestamp = this._tick()

    Object.assign(node.meta, {
      removed: false,
      removedTimestamp: timestamp,
    })

    this.emit('change', {
      type: 'restoreNode',
      timestamp,
      data: {id},
    })

    return true
  }

  makeRoot({id}) {
    if (this._nodes[id] == null) return false

    let timestamp = this._tick()

    this.rootId = id
    this.rootTimestamp = timestamp

    this.emit('change', {
      type: 'makeRoot',
      timestamp,
      data: {id},
    })

    return true
  }

  addPropValue({id, prop, propId = null, value}) {
    let node = this._nodes[id]
    if (node == null) return null

    if (propId == null) propId = this.getId()
    let timestamp = this._tick()

    let meta = {
      id: propId,
      removed: false,
      removedTimestamp: [],
      updatedTimestamp: [],
    }

    if (node.props[prop] == null || node.propsMeta[prop] == null) {
      node.props[prop] = [value]
      node.propsMeta[prop] = [meta]
    } else if (!node.propsMeta[prop].some(meta => meta.id === propId)) {
      node.props[prop].push(value)
      node.propsMeta[prop].push(meta)
    } else {
      return null
    }

    this.emit('change', {
      type: 'addPropValue',
      timestamp,
      data: {id, prop, propId, value},
    })

    return propId
  }

  removePropValueById({id, prop, propId}) {
    let node = this._nodes[id]
    if (
      node == null ||
      node.props[prop] == null ||
      node.propsMeta[prop] == null
    )
      return false

    let timestamp = this._tick()
    let meta = node.propsMeta[prop].find(meta => meta.id === propId)
    if (meta == null || meta.removed) return false

    Object.assign(meta, {
      removed: true,
      removedTimestamp: timestamp,
    })

    this.emit('change', {
      type: 'removePropValueById',
      timestamp,
      data: {id, prop, propId},
    })

    return true
  }

  removePropValue({id, prop, value}) {
    let node = this._nodes[id]
    if (
      node == null ||
      node.props[prop] == null ||
      node.propsMeta[prop] == null
    )
      return false

    let propIds = node.propsMeta[prop]
      .filter((_, i) => node.props[prop][i] === value)
      .map(meta => meta.id)

    for (let propId of propIds) {
      this.removePropValueById({id: propId, prop, propId})
    }

    return true
  }

  removeProp({id, prop}) {
    let node = this._nodes[id]
    if (
      node == null ||
      node.props[prop] == null ||
      node.propsMeta[prop] == null
    )
      return false

    for (let {id: propId} of node.propsMeta[prop]) {
      this.removePropValueById({id, prop, propId})
    }

    return true
  }

  restorePropValue({id, prop, propId}) {
    let node = this._nodes[id]
    if (
      node == null ||
      node.props[prop] == null ||
      node.propsMeta[prop] == null
    )
      return false

    let timestamp = this._tick()
    let meta = node.propsMeta[prop].find(meta => meta.id === propId)
    if (meta == null || !meta.removed) return false

    Object.assign(meta, {
      removed: false,
      removedTimestamp: timestamp,
    })

    this.emit('change', {
      type: 'restorePropValue',
      timestamp,
      data: {id, prop, propId},
    })

    return true
  }

  updatePropValue({id, prop, propId, value}) {
    let node = this._nodes[id]
    if (
      node == null ||
      node.props[prop] == null ||
      node.propsMeta[prop] == null
    )
      return false

    let index = node.propsMeta[prop].findIndex(meta => meta.id === propId)
    let oldValue = node.props[prop][index]
    if (index < 0 || oldValue === value) return false

    let timestamp = this._tick()

    node.props[prop][index] = value
    node.propsMeta[prop][index].updatedTimestamp = timestamp

    this.emit('change', {
      type: 'updatePropValue',
      timestamp,
      data: {id, prop, propId, value, oldValue},
    })

    return true
  }
}

module.exports = GameTree
