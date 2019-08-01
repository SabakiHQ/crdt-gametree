const CollaborativeText = require('./CollaborativeText')
const {diffArray, encodeNumber, wrapProperties} = require('./helper')

const nonCollaborativeTextOperationMethods = [
    'updateProperty', 'addToProperty', 'removeFromProperty'
]

const operationMethods = [
    'appendNode', 'removeNode', 'shiftNode', 'makeRoot',
    'removeProperty', ...nonCollaborativeTextOperationMethods
]

const unsafeOperationMethods = [
    'UNSAFE_appendNodeWithId'
]

class DraftProxy {
    constructor(base, draft) {
        this.id = base.id
        this.timestamp = base.timestamp
        this.collaborativeTextProperties = base.collaborativeTextProperties
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
                throw new Error('Unsafe operation methods are not supported')
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
            nonCollaborativeTextOperationMethods.includes(operation)
            && this.collaborativeTextProperties.includes(args[1])
        ) {
            throw new Error(`Properties specified in 'collaborativeTextProperties' is incompatible with '${operation}'`)
        }

        let plainArgs = args

        if (operation === 'appendNode') {
            args = [
                plainArgs[0],
                wrapProperties(
                    plainArgs[1],
                    this.collaborativeTextProperties,
                    x => new CollaborativeText(this.id, x)
                ),
                ...plainArgs.slice(2)
            ]
        }

        let ret = this.draft[operation](...args)

        // Log changes

        this.root = this.draft.root
        this.changes.push({
            id: this._createId(),
            operation,
            args: plainArgs,
            ret,
            author: this.id,
            timestamp: this.timestamp,
            _snapshot: null
        })

        return ret
    }

    _getCollaborativeTextProperty(id, property) {
        if (!this.collaborativeTextProperties.includes(property)) {
            throw new Error(`Property has to be specified in 'collaborativeTextProperties'`)
        }

        let node = this.get(id)
        if (node == null) return

        if (node.data[property] == null) {
            node.data[property] = ['']
        }

        node.data = wrapProperties(
            node.data,
            this.collaborativeTextProperties,
            x => x instanceof CollaborativeText ? x : new CollaborativeText(this.id, x)
        )

        return node.data[property][0]
    }

    updateCollaborativeTextProperty(id, property, value) {
        let node = this.get(id)
        if (node == null) return false

        let crdt = this._getCollaborativeTextProperty(id, property)
        let {deletions = [], insertions = []} = typeof value !== 'string'
            ? value
            : diffArray(crdt.valueOf(), value)

        let change = {
            deletions: deletions.map(i => crdt.getIdFromIndex(i)),
            insertions: insertions.map(insertion => ({
                at: crdt.getIdFromIndex(insertion.at),
                insert: insertion.insert
            }))
        }

        return this._updateCollaborativeTextProperty(id, property, change)
    }

    _updateCollaborativeTextProperty(id, property, change) {
        let inner = () => {
            let node = this.get(id)
            if (node == null) return false

            let crdt = this._getCollaborativeTextProperty(id, property)
            node.data[property] = [crdt.applyChange(change)]

            return true
        }

        let ret = inner()

        this.changes.push({
            id: this._createId(),
            operation: '_updateCollaborativeTextProperty',
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
