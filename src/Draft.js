class Draft {
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
    }

    get(id) {
        return this.draft.get(id)
    }
}

module.exports = Draft
