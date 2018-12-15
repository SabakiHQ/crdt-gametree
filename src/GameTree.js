const EventEmitter = require('events')
const ImmutableGameTree = require('@sabaki/immutable-gametree')
const {uuid, sha1, compareOperations} = require('./helper')
const Draft = require('./Draft')

class GameTree extends EventEmitter {
    constructor({getId = null, root} = {}) {
        super()

        this.id = uuid()
        this.timestamp = 0
        this.getId = getId || (() => {
            let id = 0
            return () => sha1(this.id, id++)
        })()

        this.base = new ImmutableGameTree({getId: this.getId, root})
        this.root = this.base.root

        this.changes = []
        this._operations = []

        // Inherit some methods from @sabaki/immutable-gametree

        let inheritedMethods = [
            'get', 'getSequence', 'navigate',
            'listNodes', 'listNodesHorizontally', 'listNodesVertically',
            'listCurrentNodes', 'listMainNodes', 'getLevel',
            'getSection', 'getCurrentHeight', 'getHeight',
            'onCurrentLine', 'onMainLine', 'toJSON'
        ]

        for (let method of inheritedMethods) {
            this[method] = (...args) => {
                return this._getGameTree()[method](...args)
            }
        }
    }

    _getGameTree() {
        for (let i = this._operations.length - 1; i >= 0; i--) {
            let {tree} = this._operations[i]
            if (tree != null) return tree
        }

        return this.base
    }

    mutate(mutator) {
        let draftShim = null
        let newTree = this.tree.mutate(draft => {
            draftShim = new Draft(this.id, this.timestamp, draft)

            return mutator(draftShim)
        })

        if (draftShim == null || draftShim.operations.length === 0) {
            return this
        }

        draftShim.operations.slice(-1)[0].tree = newTree

        let result = new GameTree({
            getId: this.getId
        })

        Object.assign(result, {
            id: this.id,
            timestamp: draftShim.timestamp,
            base: this.base,
            changes: draftShim.operations,
            _operations = [...this._operations, ...draftShim.operations]
        })

        return result
    }
}

module.exports = GameTree
