const EventEmitter = require('events')
const {uuid, sha1, compareOperations, deepClone} = require('./helper')

module.exports = class GameTree extends EventEmitter {
    constructor({id = null, base = {}} = {}) {
        this.id = id == null ? uuid() : id
        this.timestamp = 0

        this.operations = []
        this.base = Object.assign({
            node: {},
            parent: {},
            children: {}
        }, base)
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

    appendNode(parent, data) {
        let id = sha1(parent, this.id, this.timestamp)

        this._pushOperation('appendNode', {parent, id, data})

        return id
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

    getNode(id) {
        let base = deepCopy(this.base.node[id])

        for (let {type, payload} of this.operations) {
            if (payload.id !== id) continue

            if (type === 'appendNode') {
                base = deepCopy(payload.data)
            } else if (type === 'removeNode') {
                return null
            } else if (type === 'addToProperty' && base != null) {
                if (payload.property in base) {
                    if (!base[payload.property].includes(payload.value)) {
                        base[payload.property].push(payload.value)
                    }
                } else {
                    base[payload.property] = [payload.value]
                }
            } else if (type === 'removeFromProperty' && base != null) {
                if (payload.property in base) {
                    let index = base[payload.property].indexOf(payload.value)
                    if (index >= 0) base[payload.property].splice(index, 1)
                }
            } else if (type === 'updateProperty' && base != null) {
                if (payload.values != null) {
                    base[payload.property] = [...payload.values]
                } else {
                    delete base[payload.property]
                }
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
        let base = [...this.base.children[id]] || []

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
