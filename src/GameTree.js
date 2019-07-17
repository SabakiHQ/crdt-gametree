const ImmutableGameTree = require('@sabaki/immutable-gametree')
const {uuid, compareChange, sanitizeChange} = require('./helper')
const DraftProxy = require('./DraftProxy')
const ImmutableSortedSet = require('./ImmutableSortedSet')

class GameTree {
    constructor({id = null, getId = null, merger, root} = {}) {
        this.id = id == null ? uuid() : id
        this.timestamp = 0
        this.getId = getId || (() => {
            let id = 0
            return () => [this.id, id++].join('-')
        })()

        this.base = new ImmutableGameTree({getId: this.getId, merger, root})
        this.merger = this.base.merger
        this.root = this.base.root

        this._createdFrom = null
        this._changes = []
        this._history = new ImmutableSortedSet({
            cmp: compareChange,
            sanitizer: sanitizeChange
        })

        // Inherit some methods from @sabaki/immutable-gametree

        let inheritedMethods = [
            'get', 'getSequence', 'navigate',
            'listNodes', 'listNodesHorizontally', 'listNodesVertically',
            'listCurrentNodes', 'listMainNodes', 'getLevel',
            'getSection', 'getCurrentHeight', 'getHeight',
            'getStructureHash', 'onCurrentLine', 'onMainLine',
            'toJSON'
        ]

        for (let method of inheritedMethods) {
            this[method] = (...args) => {
                return this._getGameTree()[method](...args)
            }
        }
    }

    _getGameTree() {
        if (this._history.length > 0) {
            return this._history.peek().snapshot
        }

        return this.base
    }

    getChanges(oldTree = null) {
        if (oldTree === this) {
            return []
        } else if (oldTree == null || oldTree === this._createdFrom) {
            return this._changes.map(sanitizeChange)
        }

        return this.getHistory()
            .filter(x => oldTree._history.reverseFind(y => compareChange(x, y) === 0) == null)
    }

    getHistory() {
        return [...this.listHistory()].reverse()
    }

    *listHistory() {
        for (let change of this._history.reverseIter()) {
            yield sanitizeChange(change)
        }
    }

    applyChanges(changes) {
        if (changes.length === 0) return this

        let newHistory = this._history.push(changes)
        let base = this.base
        let changesOnBase = []

        // Get an appropriate base

        for (let change of newHistory.reverseIter()) {
            if (change.snapshot == null) {
                changesOnBase.push(change)
            } else {
                base = change.snapshot
                break
            }
        }

        // Generate new tree

        let newTimestamp = this.timestamp
        let newTree = base.mutate(draft => {
            for (let i = changesOnBase.length - 1; i >= 0; i--) {
                let {operation, args, ret, timestamp} = changesOnBase[i]

                newTimestamp = Math.max(newTimestamp, timestamp + 1)

                if (operation === 'appendNode') {
                    draft.UNSAFE_appendNodeWithId(args[0], ret, args[1])
                } else if (operation.includes('UNSAFE_')) {
                    throw new Error('Unsafe changes are not supported.')
                } else if (operation in draft) {
                    draft[operation](...args)
                }
            }
        })

        newHistory.peek().snapshot = newTree

        let result = new GameTree({
            id: this.id,
            getId: this.getId
        })

        Object.assign(result, {
            timestamp: newTimestamp,
            base: this.base,
            root: newTree.root,
            _createdFrom: this,
            _changes: changes,
            _history: newHistory
        })

        return result
    }

    mutate(mutator) {
        let draftProxy = null
        let newTree = this._getGameTree().mutate(draft => {
            draftProxy = new DraftProxy(this, draft)

            return mutator(draftProxy)
        })

        if (draftProxy == null || draftProxy.changes.length === 0) {
            return this
        }

        let result = new GameTree({
            id: this.id,
            getId: this.getId
        })

        let newHistory = this._history.push(draftProxy.changes)
        newHistory.peek().snapshot = newTree

        Object.assign(result, {
            timestamp: draftProxy.timestamp,
            base: this.base,
            root: newTree.root,
            _createdFrom: this,
            _changes: draftProxy.changes,
            _history: newHistory
        })

        return result
    }
}

module.exports = GameTree
