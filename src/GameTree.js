const EventEmitter = require('events')
const {uuid, sha1, compareOperations} = require('./helper')

module.exports = class GameTree extends EventEmitter {
    constructor({id = null, base = {}} = {}) {
        this.id = id == null ? uuid() : id
        this.timestamp = 0

        this.operations = []
        this.base = Object.assign({
            nodes: {},
            parents: {},
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

    pushOperation(type, payload) {
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
        this.pushOperation('appendNode', {
            parent,
            id: sha1(parent, this.id, this.timestamp),
            data
        })
    }

    removeNode(id) {
        this.pushOperation('removeNode', {id})
    }

    addToAttribute(id, attribute, value) {
        this.pushOperation('addToAttribute', {id, attribute, value})
    }

    removeFromAttribute(id, attribute, value) {
        this.pushOperation('removeFromAttribute', {id, attribute, value})
    }

    updateAttribute(id, attribute, value) {
        this.pushOperation('updateAttribute', {id, attribute, value})
    }

    removeAttribute(id, attribute) {
        this.pushOperation('updateAttribute', {id, attribute, value: null})
    }
}
