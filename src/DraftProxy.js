const StringCrdt = require('./StringCrdt')
const {diffArray, encodeNumber} = require('./helper')

const incompatibleTextOperationMethods = [
    'updateProperty', 'addToProperty', 'removeFromProperty'
]

const operationMethods = [
    'appendNode', 'removeNode', 'shiftNode', 'makeRoot',
    'removeProperty', ...incompatibleTextOperationMethods
]

const unsafeOperationMethods = [
    'UNSAFE_appendNodeWithId'
]

class DraftProxy {
    constructor(base, draft) {
        this.id = base.id
        this.timestamp = base.timestamp
        this.textProperties = base.textProperties
        this.draft = draft
        this.root = draft.root
        this.changes = []

        // Operation methods

        for (let method of operationMethods) {
            this[method] = (...args) => {
                return this._callInheritedMethod(method, args)
            }
        }

        // Block unsafe methods

        for (let method of unsafeOperationMethods) {
            this[method] = () => {
                throw new Error('Unsafe operation methods are not supported.')
            }
        }
    }

    get(id) {
        let result = this.draft.get(id)
        this.root = this.draft.root
        return result
    }

    _createId() {
        return [encodeNumber(++this.timestamp), this.id].join('-')
    }

    _callInheritedMethod(operation, args) {
        if (
            incompatibleTextOperationMethods.includes(operation)
            && this.textProperties.includes(args[1])
        ) {
            throw new Error(`Properties specified in 'textProperties' is incompatible with '${operation}'`)
        }

        let ret = this.draft[operation](...args)

        // Log changes

        this.root = this.draft.root
        this.changes.push({
            id: this._createId(),
            operation,
            args,
            ret,
            author: this.id,
            timestamp: this.timestamp,
            _snapshot: null
        })

        return ret
    }

    _wrapTextProperty(id, property) {
        if (!this.textProperties.includes(property)) {
            throw new Error(`Property has to be specified in 'textProperties'`)
        }

        let node = this.get(id)
        if (node == null) return

        if (node.data[property] == null) {
            node.data[property] = [new StringCrdt(this.id, '')]
        } else if (!(node.data[property][0] instanceof StringCrdt)) {
            node.data[property] = [new StringCrdt(this.id, node.data[property][0])]
        }

        return node.data[property][0]
    }

    updateTextProperty(id, property, value) {
        let node = this.get(id)
        if (node == null) return false

        let crdt = this._wrapTextProperty(id, property)
        let diff = diffArray(crdt.valueOf(), value)

        let change = {
            deletions: diff.deletions.map(index => crdt.getIdFromIndex(index)),
            insertions: diff.insertions.map(insertion => ({
                at: crdt.getIdFromIndex(insertion.at),
                insert: insertion.insert
            }))
        }

        return this._updateTextProperty(id, property, change)
    }

    _updateTextProperty(id, property, change) {
        let inner = () => {
            let node = this.get(id)
            if (node == null) return false

            let crdt = this._wrapTextProperty(id, property)
            node.data[property] = [crdt.applyChange(change)]

            return true
        }

        let ret = inner()

        this.changes.push({
            id: this._createId(),
            operation: '_updateTextProperty',
            args: [id, property, change],
            ret,
            author: this.id,
            timestamp: this.timestamp,
            _snapshot: null
        })

        return ret
    }
}

module.exports = DraftProxy
