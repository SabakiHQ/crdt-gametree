const EventEmitter = require('events')
const {uuid, sha1, compareOperations, deepCopy} = require('./helper')

class GameTree extends EventEmitter {
    constructor({id = null, base = {}} = {}) {
        super()

        this.id = id == null ? uuid() : id
        this.timestamp = 0

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

    // Internal operations

    _addToPropertyOnNode(node, property, value) {
        if (node == null) return

        if (node[property] != null) {
            if (!node[property].includes(value)) {
                node[property].push(value)
            }
        } else {
            node[property] = [value]
        }
    }

    _removeFromPropertyOnNode(node, property, value) {
        if (node == null) return

        if (node[property] != null) {
            let index = node[property].indexOf(value)
            if (index >= 0) node[property].splice(index, 1)
        }
    }

    _updatePropertyOnNode(node, property, values) {
        if (node == null) return

        if (values != null) {
            node[property] = [...values]
        } else {
            delete node[property]
        }
    }

    // Operation management

    flush(steps = null) {
        if (steps == null) steps = this.operations.length

        let operations = this.operations.splice(0, steps)

        for (let {id, type, payload} of operations) {
            if (type === 'appendNode') {
                this.base.node[id] = payload.node
                this.base.parent[id] = payload.parent

                if (this.base.children[payload.parent] != null) {
                    this.base.children[payload.parent].push(id)
                } else {
                    this.base.children[payload.parent] = [id]
                }
            } else if (type === 'removeNode') {
                delete this.base.node[payload.id]
                delete this.base.children[payload.id]

                let parent = this.base.parent[payload.id]
                if (parent == null) continue

                let children = this.base.children[parent]
                if (children == null) continue

                children[parent].splice(children[parent].indexOf(payload.id), 1)
            } else if (type === 'shiftNode') {
                let parent = this.base.parent[payload.id]
                if (parent == null) continue

                let children = this.base.children[parent]
                if (children == null) continue

                let index = children.indexOf(payload.id)
                if (index < 0) continue

                let newIndex = payload.direction === 'left' ? index - 1
                    : payload.direction === 'right' ? index + 1
                    : 0

                children.splice(index, 1)
                children.splice(newIndex, 0, payload.id)
            } else if (type === 'addToProperty') {
                let node = this.base.node[payload.id]
                this._addToPropertyOnNode(node, payload.property, payload.value)
            } else if (type === 'removeFromProperty') {
                let node = this.base.node[payload.id]
                this._removeFromPropertyOnNode(node, payload.property, payload.value)
            } else if (type === 'updateProperty') {
                let node = this.base.node[payload.id]
                this._updatePropertyOnNode(node, payload.property, payload.values)
            }
        }
    }

    // Get methods

    getNode(id) {
        let node = deepCopy(this.base.node[id])
        let parent = this.base.parent[id] || null
        let children = this.base.children[id] != null ? [...this.base.children[id]] : []

        for (let {id: opId, type, payload} of this.operations) {
            if (type === 'appendNode' && opId === id) {
                node = deepCopy(payload.node)
                parent = payload.parent
            } else if (type === 'removeNode' && payload.id === id) {
                node = null
            } else if (type === 'addToProperty' && node != null && payload.id === id) {
                this._addToPropertyOnNode(node, payload.property, payload.value)
            } else if (type === 'removeFromProperty' && node != null && payload.id === id) {
                this._removeFromPropertyOnNode(node, payload.property, payload.value)
            } else if (type === 'updateProperty' && node != null && payload.id === id) {
                this._removeFromPropertyOnNode(node, payload.property, payload.values)
            }

            if (type === 'removeNode' && (payload.id === id || payload.parent === id)) {
                parent = null
            }

            if (type === 'appendNode' && payload.parent === id) {
                children.push(opId)
            } else if (type === 'removeNode' && payload.id === id) {
                children = []
            } else if (type === 'removeNode') {
                let index = children.indexOf(payload.id)
                if (index >= 0) children.splice(index, 1)
            } else if (type === 'shiftNode') {
                let index = children.indexOf(payload.id)
                if (index < 0) continue

                let newIndex = payload.direction === 'left' ? index - 1
                    : payload.direction === 'right' ? index + 1
                    : 0

                children.splice(index, 1)
                children.splice(newIndex, 0, payload.id)
            }
        }

        return {parent, node, children}
    }

    getSequence(id) {
        let {parent, node, children} = this.getNode(id)
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
