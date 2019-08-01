const t = require('tap')
const GameTree = require('..')

let sanitizeChange = change => {
    delete change.id
    return change
}

t.test('getChanges method', async t => {
    let tree = new GameTree()

    t.equal(tree.getChanges().length, 0)

    let newTree = tree.mutate(draft => {
        draft.addToProperty(tree.root.id, 'MA', 'dd')
        draft.updateProperty(tree.root.id, 'MA', ['dd', 'df'])
    })

    let newTree2 = newTree.mutate(draft => {
        draft.removeFromProperty(tree.root.id, 'MA', 'df')
    })

    t.equal(tree.id, newTree.id)
    t.equal(tree.id, newTree2.id)

    t.deepEqual(newTree.getChanges().map(sanitizeChange), [
        {
            "author": tree.id,
            "args": [
                tree.root.id,
                "MA",
                "dd"
            ],
            "operation": "addToProperty",
            "ret": true,
            "timestamp": 1
        },
        {
            "author": tree.id,
            "args": [
                tree.root.id,
                "MA",
                ["dd", "df"]
            ],
            "operation": "updateProperty",
            "ret": true,
            "timestamp": 2
        }
    ])

    t.deepEqual(newTree2.getChanges(tree).map(sanitizeChange), [
        {
            "author": tree.id,
            "args": [
                tree.root.id,
                "MA",
                "dd"
            ],
            "operation": "addToProperty",
            "ret": true,
            "timestamp": 1
        },
        {
            "author": tree.id,
            "args": [
                tree.root.id,
                "MA",
                ["dd", "df"]
            ],
            "operation": "updateProperty",
            "ret": true,
            "timestamp": 2
        },
        {
            "author": tree.id,
            "args": [
                tree.root.id,
                "MA",
                "df"
            ],
            "operation": "removeFromProperty",
            "ret": true,
            "timestamp": 3
        }
    ])
})

t.test('getHistory method', async t => {
    let tree = new GameTree()

    t.deepEqual(tree.getHistory().length, 0)

    let newTree = tree.mutate(draft => {
        draft.addToProperty(tree.root.id, 'MA', 'dd')
    })

    t.deepEqual(newTree.getHistory().map(sanitizeChange), [
        {
            "author": tree.id,
            "args": [
                tree.root.id,
                "MA",
                "dd"
            ],
            "operation": "addToProperty",
            "ret": true,
            "timestamp": 1
        }
    ])

    newTree = newTree.mutate(draft => {
        draft.addToProperty(tree.root.id, 'MA', 'df')
        draft.removeFromProperty(tree.root.id, 'MA', 'dd')
    })

    t.deepEqual(newTree.getHistory().map(sanitizeChange), [
        {
            "author": tree.id,
            "args": [
                tree.root.id,
                "MA",
                "dd"
            ],
            "operation": "addToProperty",
            "ret": true,
            "timestamp": 1
        },
        {
            "author": tree.id,
            "args": [
                tree.root.id,
                "MA",
                "df"
            ],
            "operation": "addToProperty",
            "ret": true,
            "timestamp": 2
        },
        {
            "author": tree.id,
            "args": [
                tree.root.id,
                "MA",
                "dd"
            ],
            "operation": "removeFromProperty",
            "ret": true,
            "timestamp": 3
        }
    ])
})

t.test('applyChange should lead to eventual consistency', async t => {
    let tree1 = new GameTree().mutate(draft => {
        draft.updateProperty(draft.root.id, 'CR', ['dd', 'df'])
    })

    let tree2 = new GameTree().mutate(draft => {
        draft.addToProperty(draft.root.id, 'MA', 'dd')
        draft.removeFromProperty(draft.root.id, 'CR', 'df')
    })

    let newTree1 = tree1.applyChanges(tree2.getChanges())
    let newTree2 = tree2.applyChanges(tree1.getChanges())
    let appliedOwnChanges = tree1.applyChanges(tree1.getChanges())

    t.deepEqual(newTree1.getChanges(), tree2.getChanges())
    t.deepEqual(newTree2.getChanges(), tree1.getChanges())
    t.deepEqual(newTree1.getHistory(), newTree2.getHistory())

    t.deepEqual(appliedOwnChanges.root, tree1.root)
    t.deepEqual(newTree1.root, newTree2.root)
})

t.test('applyChange should resolve conflicts', async t => {
    let tree1 = new GameTree().mutate(draft => {
        draft.updateProperty(draft.root.id, 'CR', ['dd', 'df'])
    })

    let tree2 = new GameTree().mutate(draft => {
        draft.updateProperty(draft.root.id, 'CR', ['qq'])
    })

    let changeId1 = tree1.getChanges()[0].author
    let changeId2 = tree2.getChanges()[0].author
    let newTree1 = tree1.applyChanges(tree2.getChanges())
    let newTree2 = tree2.applyChanges(tree1.getChanges())

    t.deepEqual(newTree1.getChanges(), tree2.getChanges())
    t.deepEqual(newTree2.getChanges(), tree1.getChanges())
    t.deepEqual(newTree1.getHistory(), newTree2.getHistory())
    t.deepEqual(newTree1.root, newTree2.root)
    t.deepEqual(newTree1.root.data.CR, changeId1 > changeId2 ? ['dd', 'df'] : ['qq'])
})

t.test('applyChange should work with appendNode', async t => {
    let tree1 = new GameTree().mutate(draft => {
        draft.appendNode(draft.root.id, {'CR': ['dd', 'df']})
    })

    let tree2 = new GameTree()
        .applyChanges(tree1.getChanges())

    t.deepEqual(tree1.getHistory(), tree2.getHistory())
    t.deepEqual(tree1.root, tree2.root)
})

t.test('reset method', async t => {
    let second
    let tree = new GameTree().mutate(draft => {
        let id = draft.appendNode(draft.root.id, {B: ['dd']})
        second = draft.appendNode(id, {W: ['pp']})
    })

    t.strictEqual(tree.getHeight(), 3)

    let changes = tree.getChanges()
    let newTree = tree.reset(changes[0].id)
    let emptyTree = newTree.reset()

    t.strictEqual(newTree.getHeight(), 2)
    t.strictEqual(newTree.get(second), null)
    t.strictEqual(newTree.getHistory().length, 3)
    t.strictEqual(newTree.getChanges().length, 1)

    t.strictEqual(emptyTree.getHeight(), 1)
    t.strictEqual(emptyTree.get(second), null)
    t.strictEqual(emptyTree.getHistory().length, 4)
    t.strictEqual(emptyTree.getChanges().length, 1)
    t.strictEqual(emptyTree.getChanges(tree).length, 2)

    let newTree2 = emptyTree.mutate(draft => {
        draft.appendNode(draft.root.id, {B: ['dd']})
    })

    t.strictEqual(newTree2.getHeight(), 2)
    t.strictEqual(newTree2.getHistory().length, 5)
})

t.test('do not allow unsafe mutations', async t => {
    t.throws(() => {
        new GameTree().mutate(draft => {
            draft.UNSAFE_appendNodeWithId(draft.root.id, 'hello', {})
        })
    })
})

t.test('text properties cannot be normally updated, added, or removed from', async t => {
    let tree = new GameTree({collaborativeTextProperties: ['C']})

    t.throws(() => {
        tree.mutate(draft => {
            draft.updateProperty(draft.root.id, 'C', ['hello world'])
        })
    })

    t.throws(() => {
        tree.mutate(draft => {
            draft.addToProperty(draft.root.id, 'C', 'hello')
        })
    })

    t.throws(() => {
        tree.mutate(draft => {
            draft.removeFromProperty(draft.root.id, 'C', 'hello')
        })
    })
})

t.test('text property updates should be conflict-free', async t => {
    let collaborativeTextProperties = ['C']

    let id
    let tree1 = new GameTree({collaborativeTextProperties}).mutate(draft => {
        id = draft.appendNode(draft.root.id, {C: ['hlllo world']})
    })
    let tree2 = new GameTree({collaborativeTextProperties}).applyChanges(tree1.getChanges())

    let newTree1 = tree1.mutate(draft => {
        draft.updateCollaborativeTextProperty(id, 'C', {
            deletions: [1],
            insertions: [{at: 1, insert: 'e'}]
        })
    })
    let newTree2 = tree2.mutate(draft => {
        draft.updateCollaborativeTextProperty(id, 'C', {
            deletions: [3],
            insertions: [{at: 5, insert: ' cruel'}, {at: 11, insert: '!'}]
        })
    })

    let merged1 = newTree1.applyChanges(newTree2.getChanges())
    let merged2 = newTree2.applyChanges(newTree1.getChanges())

    t.equal(merged1.get(id).data.C[0].valueOf(), 'helo cruel world!')
    t.equal(merged1.get(id).data.C[0].valueOf(), merged2.get(id).data.C[0].valueOf())
})

t.test('auto diffed text property updates should be conflict-free', async t => {
    let collaborativeTextProperties = ['C']

    let id
    let tree1 = new GameTree({collaborativeTextProperties}).mutate(draft => {
        id = draft.appendNode(draft.root.id, {C: ['hlllo world']})
    })
    let tree2 = new GameTree({collaborativeTextProperties}).applyChanges(tree1.getChanges())

    let newTree1 = tree1.mutate(draft => {
        draft.updateCollaborativeTextProperty(id, 'C', 'hello world')
    })
    let newTree2 = tree2.mutate(draft => {
        draft.updateCollaborativeTextProperty(id, 'C', 'hllo cruel world!')
    })

    t.equal(newTree1.get(id).data.C[0].valueOf(), 'hello world')
    t.equal(newTree2.get(id).data.C[0].valueOf(), 'hllo cruel world!')

    let merged1 = newTree1.applyChanges(newTree2.getChanges())
    let merged2 = newTree2.applyChanges(newTree1.getChanges())

    t.equal(merged1.get(id).data.C[0].valueOf(), merged2.get(id).data.C[0].valueOf())
})

t.test('text property inserts should be continuous for given author', async t => {
    let collaborativeTextProperties = ['C']

    let id
    let value = 'Hello World'
    let tree1 = new GameTree({collaborativeTextProperties}).mutate(draft => {
        id = draft.appendNode(draft.root.id, {C: [value]})
    })
    let tree2 = new GameTree({collaborativeTextProperties}).applyChanges(tree1.getChanges())

    let newTree1 = tree1.mutate(draft => {
        draft.updateCollaborativeTextProperty(id, 'C', {
            insertions: [{at: value.length, insert: ', Yichuan'}]
        })
    })
    let newTree2 = tree2.mutate(draft => {
        draft.updateCollaborativeTextProperty(id, 'C', {
            insertions: [{at: value.length, insert: ', David'}]
        })
    })

    let merged1 = newTree1.applyChanges(newTree2.getChanges())
    let merged2 = newTree2.applyChanges(newTree1.getChanges())
    let str = merged1.get(id).data.C[0].valueOf()

    t.assert(str.endsWith(', Yichuan') || str.endsWith(', David'))
    t.equal(str, merged2.get(id).data.C[0].valueOf())
})
