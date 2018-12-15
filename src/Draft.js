class Draft {
    constructor(id, timestamp, draft) {
        this.id = id
        this.timestamp = timestamp
        this.draft = draft
        this.operations = []

        // Log operation methods

        let operationMethods = [
            'appendNode', 'UNSAFE_appendNodeWithId', 'removeNode',
            'shiftNode', 'makeRoot', 'addToProperty',
            'removeFromProperty', 'updateProperty', 'removeProperty'
        ]

        for (let method of operationMethods) {
            this[method] = (...args) => {
                let returnValue = this.draft[method](...args)
                let timestamp = this.timestamp++

                this.operations.push({
                    operation: method,
                    args,
                    returnValue,
                    id: this.id,
                    timestamp,
                    tree: null
                })

                return returnValue
            }
        }
    }

    get(id) {
        return this.draft.get(id)
    }
}

module.exports = Draft
