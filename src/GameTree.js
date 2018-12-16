const EventEmitter = require('events')
const ImmutableGameTree = require('@sabaki/immutable-gametree')
const {uuid, sha1, compareChange, sanitizeChange} = require('./helper')
const Draft = require('./Draft')

class GameTree extends EventEmitter {
    constructor({id = null, getId = null, root} = {}) {
        super()

        this.id = id != null ? uuid() : id
        this.timestamp = 0
        this.getId = getId || (() => {
            let id = 0
            return () => sha1(this.id, id++)
        })()

        this.base = new ImmutableGameTree({getId: this.getId, root})
        this.root = this.base.root

        this._changes = []
        this._history = []

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
        if (this._history.length > 0) {
            let lastOperation = this._history.slice(-1)[0]
            return lastOperation.tree
        }

        return this.base
    }

    getChanges() {
        return this._changes.map(sanitizeChange)
    }

    getHistory() {
        return this._history.map(sanitizeChange)
    }

    applyChanges(changes) {
        let newHistory = [...this._history]
        let changeIndex = newHistory.length

        if (changes.length === 0) {
            return this
        }

        // Insert changes

        for (let change of changes) {
            let i = newHistory.length
            while (i > 0 && compareChange(newHistory[i - 1], change) >= 0) i--

            changeIndex = Math.min(i, changeIndex)
            newHistory.splice(i, 0, change)
        }

        // Remove outdated data

        for (let i = changeIndex; i < newHistory.length; i++) {
            newHistory[i] = Object.assign({}, newHistory[i], {
                tree: null
            })
        }

        // Get an appropriate base

        let baseIndex = changeIndex - 1
        while (baseIndex >= 0 && newHistory[baseIndex].tree == null) baseIndex--

        let base = baseIndex < 0 ? this.base : newHistory[baseIndex].tree

        // Generate new tree

        let newTimestamp = this.timestamp
        let newTree = base.mutate(draft => {
            for (let i = baseIndex + 1; i < newHistory.length; i++) {
                let {operation, args, returnValue, timestamp} = newHistory[i]

                newTimestamp = Math.max(newTimestamp, timestamp + 1)

                try {
                    if (operation === 'appendNode') {
                        draft.UNSAFE_appendNodeWithId(args[0], returnValue, args[1])
                    } else {
                        draft[operation](...args)
                    }
                } catch (err) {}
            }
        })

        newHistory.slice(-1)[0].tree = newTree

        let result = new GameTree({
            id: this.id,
            getId: this.getId
        })

        Object.assign(result, {
            timestamp: newTimestamp,
            base: this.base,
            root: newTree.root,
            _changes: changes,
            _history: newHistory
        })

        return result
    }

    mutate(mutator) {
        let draftShim = null
        let newTree = this._getGameTree().mutate(draft => {
            draftShim = new Draft(this, draft)

            return mutator(draftShim)
        })

        if (draftShim == null || draftShim.changes.length === 0) {
            return this
        }

        draftShim.changes.slice(-1)[0].tree = newTree

        let result = new GameTree({
            id: this.id,
            getId: this.getId
        })

        Object.assign(result, {
            timestamp: draftShim.timestamp,
            base: this.base,
            root: newTree.root,
            _changes: draftShim.changes,
            _history: [...this._history, ...draftShim.changes]
        })

        return result
    }
}

module.exports = GameTree
