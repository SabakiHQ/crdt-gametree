const t = require('tap')
const GameTree = require('..')

let sanitizeChange = change => {
    delete change.id
    return change
}

t.test('getChanges method', t => {
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
            "timestamp": 0
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
            "timestamp": 1
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
            "timestamp": 0
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
            "timestamp": 1
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
            "timestamp": 2
        }
    ])

    t.end()
})

t.test('getHistory method', t => {
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
            "timestamp": 0
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
            "timestamp": 0
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
            "timestamp": 1
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
            "timestamp": 2
        }
    ])

    t.end()
})

t.test('applyChange should lead to eventual consistency', t => {
    let base = new GameTree()
    let tree1 = base.mutate(draft => {
        draft.updateProperty(draft.root.id, 'CR', ['dd', 'df'])
    })

    let tree2 = new GameTree({root: base.root}).mutate(draft => {
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

    t.end()
})

t.test('applyChange should resolve conflicts', t => {
    let base = new GameTree()
    let tree1 = base.mutate(draft => {
        draft.updateProperty(draft.root.id, 'CR', ['dd', 'df'])
    })

    let tree2 = new GameTree({root: base.root}).mutate(draft => {
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

    t.end()
})

t.test('applyChange should work with appendNode', t => {
    let base = new GameTree()
    let tree1 = base.mutate(draft => {
        draft.appendNode(draft.root.id, {'CR': ['dd', 'df']})
    })

    let tree2 = new GameTree({root: base.root})
        .applyChanges(tree1.getChanges())

    t.deepEqual(tree1.getHistory(), tree2.getHistory())
    t.deepEqual(tree1.root, tree2.root)

    t.end()
})

t.test('do not allow unsafe mutations', t => {
    t.throws(() => {
        new GameTree().mutate(draft => {
            draft.UNSAFE_appendNodeWithId(draft.root.id, 'hello', {})
        })
    })

    t.throws(() => {
        let tree = new GameTree()

        tree.applyChanges([{
            id: 0,
            operation: 'UNSAFE_appendNodeWithId',
            args: [tree.root.id, 'hello', {}],
            ret: true,
            author: tree.id,
            timestamp: 1
        }])
    })

    t.end()
})
