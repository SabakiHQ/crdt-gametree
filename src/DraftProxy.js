const CollaborativeText = require('./CollaborativeText')
const {diffString, encodeNumber, wrapProperties} = require('./helper')

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

class Draft {
    constructor(base, draft) {
        this.id = base.id
        this.timestamp = base.timestamp
        this.base = base
        this.draft = draft
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

    get root() {
        return this.draft.root
    }

    get(id) {
        let result = this.draft.get(id)
        return result
    }

    _callInheritedMethod(operation, args) {
        if (
            nonCollaborativeTextOperationMethods.includes(operation)
            && this.base.collaborativeTextProperties.includes(args[1])
        ) {
            throw new Error(`Properties specified in 'collaborativeTextProperties' is incompatible with '${operation}'`)
        }

        let plainArgs = args

        if (operation === 'appendNode') {
            args = [
                plainArgs[0],
                wrapProperties(
                    plainArgs[1],
                    this.base.collaborativeTextProperties,
                    x => new CollaborativeText(this.id, x)
                ),
                ...plainArgs.slice(2)
            ]
        }

        let ret = this.draft[operation](...args)

        // Log changes

        this.changes.push({
            id: this.base.getId(),
            operation,
            args: plainArgs,
            ret,
            author: this.id,
            timestamp: ++this.timestamp
        })

        return ret
    }

    _getCollaborativeTextProperty(id, property) {
        if (!this.base.collaborativeTextProperties.includes(property)) {
            throw new Error(`Property has to be specified in 'collaborativeTextProperties'`)
        }

        let node = this.get(id)
        if (node == null) return

        if (node.data[property] == null) {
            node.data[property] = ['']
        }

        node.data = wrapProperties(
            node.data,
            this.base.collaborativeTextProperties,
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
            : diffString(crdt.valueOf(), value)

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
        let ret = false
        let node = this.get(id)

        if (node != null) {
            let crdt = this._getCollaborativeTextProperty(id, property)
            node.data[property] = [crdt.applyChange(change)]
            ret = true
        }

        this.changes.push({
            id: this.base.getId(),
            operation: '_updateCollaborativeTextProperty',
            args: [id, property, change],
            ret,
            author: this.id,
            timestamp: ++this.timestamp
        })

        return ret
    }
}

module.exports = Draft
