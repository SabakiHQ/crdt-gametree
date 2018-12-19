const t = require('tap')
const GameTree = require('..')
const stripIds = arr => arr.map(x => {delete x.id; return x})

t.test('getChanges', t => {
    let tree = new GameTree()

    t.equal(tree.getChanges().length, 0)

    let newTree = tree.mutate(draft => {
        draft.addToProperty(tree.root.id, 'MA', 'dd')
        draft.updateProperty(tree.root.id, 'MA', ['dd', 'df'])
        draft.removeFromProperty(tree.root.id, 'MA', 'df')
    })

    t.equal(tree.id, newTree.id)
    t.deepEqual(stripIds(newTree.getChanges()), [
        {
            "actorId": tree.id,
            "args": [
                tree.root.id,
                "MA",
                "dd"
            ],
            "operation": "addToProperty",
            "returnValue": true,
            "timestamp": 0
        },
        {
            "actorId": tree.id,
            "args": [
                tree.root.id,
                "MA",
                ["dd", "df"]
            ],
            "operation": "updateProperty",
            "returnValue": true,
            "timestamp": 1
        },
        {
            "actorId": tree.id,
            "args": [
                tree.root.id,
                "MA",
                "df"
            ],
            "operation": "removeFromProperty",
            "returnValue": true,
            "timestamp": 2
        }
    ])

    t.end()
})

t.test('getHistory', t => {
    let tree = new GameTree()

    t.deepEqual(tree.getHistory().length, 0)

    let newTree = tree.mutate(draft => {
        draft.addToProperty(tree.root.id, 'MA', 'dd')
    })

    t.deepEqual(stripIds(newTree.getHistory()), [
        {
            "actorId": tree.id,
            "args": [
                tree.root.id,
                "MA",
                "dd"
            ],
            "operation": "addToProperty",
            "returnValue": true,
            "timestamp": 0
        }
    ])

    newTree = newTree.mutate(draft => {
        draft.addToProperty(tree.root.id, 'MA', 'df')
        draft.removeFromProperty(tree.root.id, 'MA', 'dd')
    })

    t.deepEqual(stripIds(newTree.getHistory()), [
        {
            "actorId": tree.id,
            "args": [
                tree.root.id,
                "MA",
                "dd"
            ],
            "operation": "addToProperty",
            "returnValue": true,
            "timestamp": 0
        },
        {
            "actorId": tree.id,
            "args": [
                tree.root.id,
                "MA",
                "df"
            ],
            "operation": "addToProperty",
            "returnValue": true,
            "timestamp": 1
        },
        {
            "actorId": tree.id,
            "args": [
                tree.root.id,
                "MA",
                "dd"
            ],
            "operation": "removeFromProperty",
            "returnValue": true,
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

    let changeId1 = tree1.getChanges()[0].id
    let changeId2 = tree2.getChanges()[0].id
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
            returnValue: true,
            actorId: tree.id,
            timestamp: 1
        }])
    })

    t.end()
})
