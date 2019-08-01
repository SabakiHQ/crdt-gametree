const ImmutableGameTree = require('@sabaki/immutable-gametree')
const CollaborativeText = require('./CollaborativeText')
const DraftProxy = require('./DraftProxy')
const ImmutableSortedSet = require('./ImmutableSortedSet')
const {encodeNumber, uuid, compareChange, sanitizeChange, wrapProperties} = require('./helper')

const rootId = '02JXJgZ01FqtDf03fvq9F00qN3m7'
const inheritedMethods = [
    'get', 'getSequence', 'navigate',
    'listNodes', 'listNodesHorizontally', 'listNodesVertically',
    'listCurrentNodes', 'listMainNodes', 'getLevel',
    'getSection', 'getCurrentHeight', 'getHeight',
    'getStructureHash', 'onCurrentLine', 'onMainLine',
    'toJSON'
]

class GameTree {
    constructor({id, getId, merger, root, collaborativeTextProperties = []} = {}) {
        this.id = id == null ? uuid() : id
        this.timestamp = 0
        this.getId = getId || (i => () => [encodeNumber(++i), this.id].join('-'))(0)

        if (root == null) {
            root = {id: rootId, data: {}, parentId: null, children: []}
        } else if (root.id == null) {
            root.id = rootId
        }

        this.base = new ImmutableGameTree({getId: this.getId, merger, root})
        this.merger = this.base.merger
        this.root = this.base.root
        this.collaborativeTextProperties = collaborativeTextProperties

        this._createdFrom = null
        this._changes = []
        this._history = new ImmutableSortedSet({
            cmp: compareChange,
            sanitizer: sanitizeChange
        })

        // Inherit some methods from @sabaki/immutable-gametree

        for (let method of inheritedMethods) {
            this[method] = (...args) => {
                return this._getGameTree()[method](...args)
            }
        }
    }

    _getGameTree() {
        if (this._history.length > 0) {
            return this._history.peek()._snapshot
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

    _getSnapshot(history, changeId = null) {
        if (changeId == null) {
            return this.base
        }

        // Get an appropriate base

        let snapshotChange = null
        let recordChanges = false
        let changesOnBase = []
        let base = this.base

        for (let change of history.reverseIter()) {
            if (change.id === changeId) {
                recordChanges = true
                snapshotChange = change
            }

            if (change._snapshot == null && recordChanges) {
                if (change.operation === '$reset') {
                    let newBase = change.args[0]
                        ? this._getSnapshot(history, change.args[0])
                        : this.base

                    if (newBase == null) continue
                    base = newBase

                    break
                } else {
                    changesOnBase.push(change)
                }
            } else if (recordChanges) {
                base = change._snapshot
                break
            }
        }

        if (snapshotChange == null) {
            return null
        }

        // Generate new tree

        let newTree = base.mutate(draft => {
            let draftProxy = new DraftProxy(this, draft)

            for (let i = changesOnBase.length - 1; i >= 0; i--) {
                let {operation, args, ret} = changesOnBase[i]

                try {
                    if (operation === 'appendNode') {
                        draft.UNSAFE_appendNodeWithId(
                            args[0],
                            ret,
                            wrapProperties(
                                args[1],
                                this.collaborativeTextProperties,
                                x => new CollaborativeText(this.id, x)
                            ),
                            ...args.slice(2)
                        )
                    } else if (operation.includes('UNSAFE_')) {
                        // Unsafe changes are not supported
                    } else if (operation in draft) {
                        draft[operation](...args)
                    } else if (operation === '_updateCollaborativeTextProperty') {
                        draftProxy._updateCollaborativeTextProperty(...args)
                    }
                } catch (err) {
                    // Ignore
                }
            }
        })

        snapshotChange._snapshot = newTree

        return newTree
    }

    applyChanges(changes) {
        if (changes.length === 0) return this

        let newHistory = this._history.push(changes)
        let timestamp = newHistory.peek().timestamp
        let snapshot = this._getSnapshot(newHistory, newHistory.peek().id)

        let result = new GameTree({
            id: this.id,
            getId: this.getId,
            merger: this.merger,
            collaborativeTextProperties: this.collaborativeTextProperties
        })

        Object.assign(result, {
            timestamp,
            base: this.base,
            root: snapshot.root,
            _history: newHistory,
            _createdFrom: this,
            _changes: changes
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
            getId: this.getId,
            merger: this.merger,
            collaborativeTextProperties: this.collaborativeTextProperties
        })

        let newHistory = this._history.push(draftProxy.changes)
        newHistory.peek()._snapshot = newTree

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

    reset(changeId = null) {
        let timestamp = this.timestamp + 1

        return this.applyChanges([
            {
                id: [encodeNumber(timestamp), this.id].join('-'),
                operation: '$reset',
                args: [changeId],
                ret: null,
                author: this.id,
                timestamp
            }
        ])
    }
}

module.exports = GameTree
