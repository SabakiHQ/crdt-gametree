const t = require('tap')
const GameTree = require('..')

t.test('getChanges', t => {
    let tree = new GameTree()

    t.deepEqual(tree.getChanges(), [])

    let newTree = tree.mutate(draft => {
        draft.addToProperty(tree.root.id, 'MA', 'dd')
        draft.updateProperty(tree.root.id, 'MA', ['dd', 'df'])
        draft.removeFromProperty(tree.root.id, 'MA', 'df')
    })

    t.equal(tree.id, newTree.id)
    t.deepEqual(newTree.getChanges(), [
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

    t.deepEqual(tree.getHistory(), [])

    let newTree = tree.mutate(draft => {
        draft.addToProperty(tree.root.id, 'MA', 'dd')
    })

    t.deepEqual(newTree.getHistory(), [
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

    t.deepEqual(newTree.getHistory(), [
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
