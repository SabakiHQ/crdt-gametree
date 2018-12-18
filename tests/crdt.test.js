const t = require('tap')
const GameTree = require('..')

t.test('getChanges', t => {
    let tree = new GameTree()

    t.deepEqual(tree.getChanges(), [])

    let newTree = tree.mutate(draft => {
        draft.addToProperty(tree.root.id, 'MA', 'dd')
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
                "df"
            ],
            "operation": "removeFromProperty",
            "returnValue": true,
            "timestamp": 1
        }
    ])

    t.end()
})

