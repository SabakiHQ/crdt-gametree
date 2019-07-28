const {encodeNumber} = require('./helper')

class DraftProxy {
    constructor(base, draft) {
        this.id = base.id
        this.timestamp = base.timestamp
        this.textProperties = base.textProperties
        this.draft = draft
        this.root = draft.root
        this.changes = []

        // Operation methods

        let incompatibleTextOperationMethods = [
            'addToProperty', 'removeFromProperty'
        ]

        let operationMethods = [
            'appendNode', 'removeNode', 'shiftNode', 'makeRoot',
            'updateProperty', 'removeProperty', ...incompatibleTextOperationMethods
        ]

        for (let method of operationMethods) {
            this[method] = (...args) => {
                if (
                    incompatibleTextOperationMethods.includes(method)
                    && this.textProperties.includes(args[1])
                ) {
                    throw new Error(
                        `Properties specified in 'textProperties' is incompatible with '${method}'`
                    )
                }

                let ret = this.draft[method](...args)
                let timestamp = this.timestamp++

                // Log changes

                this.root = draft.root
                this.changes.push({
                    id: [encodeNumber(timestamp), this.id].join('-'),
                    operation: method,
                    args,
                    ret,
                    author: this.id,
                    timestamp,
                    _snapshot: null
                })

                return ret
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
