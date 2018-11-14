const t = require('tap')
const GameTree = require('..')

t.test('appendNode operation', t => {
    let tree = new GameTree()

    let [id1, id2] = tree.appendNodes(tree.root, [{B: ['dd']}, {W: ['dq']}])
    let node1 = tree.getNode(id1)
    let node2 = tree.getNode(id2)

    t.equal(node1.parent, tree.root)
    t.equal(node2.parent, id1)
    t.deepEqual(node1.children, [id2])
    t.deepEqual(node2.children, [])
    t.deepEqual(node1.node, {B: ['dd']})
    t.deepEqual(node2.node, {W: ['dq']})

    let id3 = tree.appendNode(id1, {W: ['qd']})
    node1 = tree.getNode(id1)

    t.deepEqual(node1.children, [id2, id3])
    t.end()
})

t.test('removeNode operation', t => {
    let tree = new GameTree()

    let [id1, id2] = tree.appendNodes(tree.root, [{B: ['dd']}, {W: ['dq']}])
    let [id3, id4] = tree.appendNodes(id1, [{B: ['dd']}, {W: ['dq']}])

    tree.removeNode(id4)
    let node3 = tree.getNode(id3)

    t.assert(tree.getNode(id4).node == null)
    t.deepEqual(node3.children, [])

    tree.removeNode(id2)
    let node1 = tree.getNode(id1)

    t.deepEqual(node1.children, [id3])
    t.end()
})

t.test('shiftNode operation', t => {
    let tree = new GameTree()

    let [id1, id2] = tree.appendNodes(tree.root, [{B: ['dd']}, {W: ['dq']}])
    let [id3] = tree.appendNodes(id1, [{B: ['dd']}, {W: ['dq']}])
    let [id4] = tree.appendNodes(id1, [{B: ['dd']}, {W: ['dq']}])

    let node1 = tree.getNode(id1)
    t.deepEqual(node1.children, [id2, id3, id4])

    tree.shiftNode(id3, 'left')
    node1 = tree.getNode(id1)
    t.deepEqual(node1.children, [id3, id2, id4])

    tree.shiftNode(id2, 'right')
    node1 = tree.getNode(id1)
    t.deepEqual(node1.children, [id3, id4, id2])

    tree.shiftNode(id2, 'main')
    node1 = tree.getNode(id1)
    t.deepEqual(node1.children, [id2, id3, id4])

    t.end()
})

t.test('addToProperty operation', t => {
    let tree = new GameTree()
    let id = tree.appendNode(tree.root, {B: ['dd']})

    tree.addToProperty(id, 'B', 'dd')
    let node = tree.getNode(id)
    t.deepEqual(node.node.B, ['dd'])

    tree.addToProperty(id, 'MA', 'dd')
    node = tree.getNode(id)
    t.deepEqual(node.node, {B: ['dd'], MA: ['dd']})

    tree.addToProperty(id, 'MA', 'dq')
    node = tree.getNode(id)
    t.deepEqual(node.node, {B: ['dd'], MA: ['dd', 'dq']})

    t.end()
})

t.test('removeFromProperty operation', t => {
    let tree = new GameTree()
    let id = tree.appendNode(tree.root, {B: ['dd']})

    tree.removeFromProperty(id, 'B', 'dq')
    let node = tree.getNode(id)
    t.deepEqual(node.node.B, ['dd'])

    tree.removeFromProperty(id, 'MA', 'dd')
    node = tree.getNode(id)
    t.deepEqual(node.node, {B: ['dd']})

    tree.removeFromProperty(id, 'B', 'dd')
    node = tree.getNode(id)
    t.deepEqual(node.node, {})

    t.end()
})

t.test('updateProperty operation', t => {
    let tree = new GameTree()
    let id = tree.appendNode(tree.root, {B: ['dd']})

    tree.updateProperty(id, 'B', ['dq'])
    let node = tree.getNode(id)
    t.deepEqual(node.node.B, ['dq'])

    tree.updateProperty(id, 'MA', ['dd', 'dq'])
    node = tree.getNode(id)
    t.deepEqual(node.node, {B: ['dq'], MA: ['dd', 'dq']})

    tree.updateProperty(id, 'B', null)
    node = tree.getNode(id)
    t.deepEqual(node.node, {MA: ['dd', 'dq']})

    t.end()
})
