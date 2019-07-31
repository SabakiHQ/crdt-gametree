# crdt-gametree [![Build Status](https://travis-ci.org/SabakiHQ/crdt-gametree.svg?branch=master)](https://travis-ci.org/SabakiHQ/crdt-gametree)

WIP: An immutable, conflict-free replicated game tree data type.

## Installation

Use npm to install:

~~~sh
$ npm install @sabaki/crdt-gametree
~~~

## Usage

~~~js
const GameTree = require('@sabaki/crdt-gametree')

let tree1 = new GameTree()
let tree2 = new GameTree()

let newTree1 = tree1.mutate(draft => {
    let id1 = draft.appendNode(draft.root.id, {B: ['dd']})
    let id2 = draft.appendNode(id1, {W: ['dq']})

    draft.addToProperty(id2, 'W', 'qd')
})

let newTree2 = tree2.mutate(draft => {
    draft.updateProperty(draft.root.id, 'AB', ['dd'])
    draft.appendNode(draft.root.id, {W: ['dp']})
})

let mergedTree1 = newTree1.applyChanges(newTree2.getChanges())
let mergedTree2 = newTree2.applyChanges(newTree1.getChanges())

console.log(newTree1 !== tree1)
// => true
console.log(newTree2 !== tree2)
// => true
console.log(newTree1 !== newTree2)
// => true
console.log(newTree1 !== mergedTree1)
// => true
console.log(newTree2 !== mergedTree2)
// => true
console.log(JSON.stringify(mergedTree1.root) === JSON.stringify(mergedTree2.root))
// => true
~~~
