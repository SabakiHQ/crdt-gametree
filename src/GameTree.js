const EventEmitter = require('events')
const {uuid, sha1, compareOperations, deepCopy} = require('./helper')

class GameTree extends EventEmitter {
    constructor({id = null, base = {}, autoFlush = Infinity} = {}) {
        super()

        this.id = id == null ? uuid() : id
        this.timestamp = 0
        this.autoFlush = autoFlush

        this.root = sha1('')
        this.base = Object.assign({
            node: {
                [this.root]: {}
            },
            parent: {},
            children: {}
        }, base)

        this.operations = []
    }

    // External operations

    applyOperation(operation) {
        let {id, timestamp} = operation

        if (timestamp <= this.timestamp - this.autoFlush) throw new Error('Operation too old.')
        if (this.operations.some(o => o.id === id)) return
        if (timestamp > this.timestamp) this.timestamp = timestamp

        let i = this.operations.length - 1

        while (i >= 0) {
            let op = this.operations[i]
            let comparison = compareOperations(op, operation)
            if (comparison <= 0) break

            i--
        }

        this.operations.splice(i + 1, 0, operation)
        this._flushOldOperations()
    }

    // Local operations

    _pushOperation(type, payload) {
        this.timestamp++

        let operation = {
            id: sha1(this.id, this.timestamp),
            author: this.id,
            timestamp: this.timestamp,
            type,
            payload
        }

        this.operations.push(operation)
        this._flushOldOperations()
        this.emit('operation', operation)

        return operation
    }

    appendNode(parent, node) {
        let operation = this._pushOperation('appendNode', {parent, node})

        return operation.id
    }

    appendNodes(parent, data) {
        let id = parent
        let ids = []

        for (let node of data) {
            id = this.appendNode(id, node)
            ids.push(id)
        }

        return ids
    }

    removeNode(id) {
        this._pushOperation('removeNode', {id})
    }

    shiftNode(id, direction) {
        if (!['left', 'right', 'main'].includes(direction)) return

        this._pushOperation('shiftNode', {id, direction})
    }

    addToProperty(id, property, value) {
        this._pushOperation('addToProperty', {id, property, value})
    }

    removeFromProperty(id, property, value) {
        this._pushOperation('removeFromProperty', {id, property, value})
    }

    updateProperty(id, property, values) {
        this._pushOperation('updateProperty', {id, property, values})
    }

    removeProperty(id, property) {
        this.updateProperty(id, property, null)
    }

    // Operation management

    flushOperations(base, operations) {
        for (let {id, type, payload} of operations) {
            if (type === 'appendNode') {
                base.node[id] = payload.node
                base.parent[id] = payload.parent

                if (base.children[payload.parent] != null) {
                    base.children[payload.parent].push(id)
                } else {
                    base.children[payload.parent] = [id]
                }
            } else if (type === 'removeNode') {
                delete base.node[payload.id]
                delete base.children[payload.id]

                let parent = base.parent[payload.id]
                if (parent == null) continue

                let children = base.children[parent]
                if (children == null) continue

                children.splice(children.indexOf(payload.id), 1)
            } else if (type === 'shiftNode') {
                let parent = base.parent[payload.id]
                if (parent == null) continue

                let children = base.children[parent]
                if (children == null) continue

                let index = children.indexOf(payload.id)
                if (index < 0) continue

                let newIndex = payload.direction === 'left' ? index - 1
                    : payload.direction === 'right' ? index + 1
                    : 0

                children.splice(index, 1)
                children.splice(newIndex, 0, payload.id)
            } else if (type === 'addToProperty') {
                let node = base.node[payload.id]
                let {property, value} = payload
                if (node == null) return

                if (node[property] != null) {
                    if (!node[property].includes(value)) {
                        node[property].push(value)
                    }
                } else {
                    node[property] = [value]
                }
            } else if (type === 'removeFromProperty') {
                let node = base.node[payload.id]
                let {property, value} = payload
                if (node == null) return

                if (node[property] != null) {
                    let index = node[property].indexOf(value)
                    if (index >= 0) node[property].splice(index, 1)
                }
            } else if (type === 'updateProperty') {
                let node = base.node[payload.id]
                let {property, values} = payload
                if (node == null) return

                if (values != null) {
                    node[property] = [...values]
                } else {
                    delete node[property]
                }
            }
        }

        return base
    }

    flush(steps = null) {
        if (steps == null) steps = this.operations.length
        if (steps <= 0) return

        let operations = this.operations.splice(0, steps)
        this.flushOperations(this.base, operations)
    }

    _flushOldOperations() {
        let steps = this.operations.findIndex(o => o.timestamp > this.timestamp - this.autoFlush)
        if (steps < 0) steps = this.operations.length

        this.flush(steps)
    }

    // Get methods

    toObject() {
        return this.flushOperations(deepCopy(this.base), this.operations)
    }

    getNode(id) {
        let base = {
            node: {[id]: deepCopy(this.base.node[id])},
            parent: {[id]: this.base.parent[id] || null},
            children: {[id]: this.base.children[id] != null ? [...this.base.children[id]] : []}
        }

        this.flushOperations(base, this.operations)

        return {
            node: base.node[id],
            parent: base.parent[id],
            children: base.children[id]
        }
    }

    getSequence(id) {
        let {node, parent, children} = this.getNode(id)
        if (node == null) return null

        let nodes = [node]
        let ids = [id]

        while (children.length === 1) {
            let child = this.getNode(children[0])

            ids.push(children[0])
            nodes.push(child.node)

            children = child.children
        }

        return {parent, ids, nodes, children}
    }
}

module.exports = GameTree
