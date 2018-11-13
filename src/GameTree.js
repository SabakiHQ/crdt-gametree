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
    }

    appendNode(parent, node) {
        let id = sha1(parent, this.id, this.timestamp)

        this._pushOperation('appendNode', {parent, id, node})

        return id
    }

    appendNodes(parent, data) {
        let id = parent
        let ids = []

        for (let node of data) {
            id = this.appendNode(id, node)
            ids.push(id)
        }

        return
    }

    removeNode(id) {
        this._pushOperation('removeNode', {id})
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
        this._pushOperation('updateProperty', {id, property, values: null})
    }

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

    flush(steps) {
        let operations = this.operations.splice(0, steps)

        for (let {type, payload} of operations) {
            if (type === 'appendNode') {
                this.base.node[payload.id] = payload.node
                this.base.parent[payload.id] = payload.parent

                if (this.base.children[payload.parent] != null) {
                    this.base.children[payload.parent].push(payload.id)
                } else {
                    this.base.children[payload.parent] = [payload.id]
                }
            } else if (type === 'removeNode') {
                delete this.base.node[payload.id]
                delete this.base.children[payload.id]

                let parent = this.base.parent[payload.id]
                if (parent != null && this.base.children[parent] != null) {
                    this.base.children[parent].splice(this.base.children[parent].indexOf(payload.id), 1)
                }
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

    getNode(id) {
        let base = deepCopy(this.base.node[id])

        for (let {type, payload} of this.operations) {
            if (payload.id !== id) continue

            if (type === 'appendNode') {
                base = deepCopy(payload.node)
            } else if (type === 'removeNode') {
                return null
            } else if (type === 'addToProperty' && base != null) {
                this._addToPropertyOnNode(base, payload.property, payload.value)
            } else if (type === 'removeFromProperty' && base != null) {
                this._removeFromPropertyOnNode(base, payload.property, payload.value)
            } else if (type === 'updateProperty' && base != null) {
                this._removeFromPropertyOnNode(base, payload.property, payload.values)
            }
        }

        return base
    }

    getParent(id) {
        let base = this.base.parent[id]

        for (let {type, payload} of this.operations) {
            if (type === 'appendNode' && payload.id === id) {
                base = payload.parent
            } else if (type === 'removeNode' && (payload.id === id || payload.parent === id)) {
                return null
            }
        }

        return base
    }

    getChildren(id) {
        let base = this.base.children[id] != null ? [...this.base.children[id]] : []

        for (let {type, payload} of this.operations) {
            if (type === 'appendNode' && payload.parent === id) {
                base.push(payload.id)
            } else if (type === 'removeNode') {
                if (payload.id === id) {
                    return []
                } else {
                    let index = base.indexOf(id)
                    if (index >= 0) base.splice(index, 1)
                }
            }
        }

        return base
    }

    getSequence(id) {
        let node = this.getNode(id)
        let nodes = [node]
        let children = this.getChildren(id)

        while (children.length === 1) {
            let child = this.getNode(children[0])
            nodes.push(child)
            children = this.getChildren(children[0])
        }

        return {nodes, children}
    }
}

module.exports = GameTree
