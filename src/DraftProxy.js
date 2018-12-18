const {sha1} = require('./helper')

class DraftProxy {
    constructor(base, draft) {
        this.id = base.id
        this.timestamp = base.timestamp
        this.draft = draft
        this.root = draft.root
        this.changes = []

        // Log changes

        let operationMethods = [
            'appendNode', 'removeNode', 'shiftNode', 'makeRoot',
            'addToProperty', 'removeFromProperty', 'updateProperty', 'removeProperty'
        ]

        for (let method of operationMethods) {
            this[method] = (...args) => {
                let returnValue = this.draft[method](...args)
                let timestamp = this.timestamp++

                this.root = draft.root
                this.changes.push({
                    id: sha1(this.id, timestamp),
                    operation: method,
                    args,
                    returnValue,
                    actorId: this.id,
                    timestamp,
                    tree: null
                })

                return returnValue
            }
        }

        // Block unsafe methods

        let unsafeMethods = [
            'UNSAFE_appendNodeWithId'
        ]

        for (let method of unsafeMethods) {
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
}

module.exports = DraftProxy
