# @sabaki/crdt-gametree [![Build Status](https://travis-ci.org/SabakiHQ/crdt-gametree.svg?branch=master)](https://travis-ci.org/SabakiHQ/crdt-gametree)

An immutable, conflict-free replicated game tree data type.

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

console.log(
    newTree1 !== tree1
    && newTree2 !== tree2
    && newTree1 !== newTree2
    && newTree1 !== mergedTree1
    && newTree2 !== mergedTree2
    && mergedTree1 !== mergedTree2
)
// => true
console.log(JSON.stringify(mergedTree1.root) === JSON.stringify(mergedTree2.root))
// => true
~~~

## API

This library is based upon and is completely compatible with [@sabaki/immutable-gametree](https://github.com/SabakiHQ/immutable-gametree). Nearly all properties, functions, and behavior that [@sabaki/immutable-gametree](https://github.com/SabakiHQ/immutable-gametree) exports you can expect in this library as well.

We will only point out subtle differences and additional functions in this document. Please consult the [@sabaki/immutable-gametree documentation](https://github.com/SabakiHQ/immutable-gametree#api) for a full overview of the functionalities.

---

### Node Object

A node is represented by an object of the following form:

~~~js
{
    id: <Primitive>,
    data: {
        [property: <String>]: <Array<Primitive>> | <Array<CollaborativeText>>
    },
    parentId: <Primitive> | null,
    children: <Array<NodeObject>>
}
~~~

Note that a so-called [collaborative text property](#collaborative-text-property) can contain a non-primitive value. To get the string value from a `CollaborativeText`, simply call the instance function `toString()`. The class `CollaborativeText` serializes into a JSON string, so calling `JSON.stringify` on node objects will still work.

### Collaborative Text Properties

Adding and removing values to or from properties are merged when happening simultaneously. However, if you have a property that only has a single value and needs to be replaced, the update will follow the "winner takes it all" strategy.

That means if two users update a single property value simultaneously, only the changes of one user will be reflected in the game tree eventually. The changes of the other user will be discarded.

To allow collaborative editing for certain cases, you can specify certain properties as *collaborative text properties*. These properties can only contain one value, a `CollaborativeText` class which contains the string.

Updates to a collaborative text property made by multiple users will be merged consistently in the end.

### Change Object

Every mutation operation made to a game tree draft will be represented by a change object:

~~~js
{
    id: <Primitive>,
    operation: <String>,
    args: <Array>,
    ret,
    author: <Primitive>,
    timestamp: <Number>
}
~~~

`id` contains a unique change id while `author` contains the `GameTree` id that made the change.

---

### `class GameTree`

#### `new GameTree([options])`

- `options` `<Object>` *(optional)*
    - `id` `<Primitive>` *(optional)* - A unique author id. Default: A random UUID
    - `collaborativeTextProperties` `<Array<String>>` *(optional)* - An array of property identifiers that are [collaborative text properties](#collaborative-text-properties)
    - See [@sabaki/immutable-gametree `GameTree`](https://github.com/SabakiHQ/immutable-gametree#new-gametreeoptions)
        - `getId` `<Function>` *(optional)* - If you specify this function, you have to make sure it generates globally unique ids, not just locally unique ones.

#### `tree.id`

`<Primitive>` - The unique author id.

#### `tree.timestamp`

`<Number>` - Current logical timestamp.

#### `tree.collaborativeTextProperties`

`<Array<String>>` - An array of property identifiers that are [collaborative text properties](#collaborative-text-properties). This property will be inherited to all mutations.

#### `*tree.listHistory()`

A generator function that yields all [changes](#change-object) made to the tree since initialization in reverse order.

#### `tree.getHistory()`

Returns an array of [change objects](#change-object) that consists of all the changes made to the tree since initialization in logical order.

#### `tree.getChanges([oldTree])`

- `oldTree` [`<GameTree>`](#class-gametree) *(optional)*

Compares the history of `tree` and `oldTree` and returns an array of [changes](#change-object) that are missing in `tree` in logical order.

`oldTree` defaults to the game tree we mutated from.

#### `tree.applyChanges(changes)`

- `changes` [`<Array<Change>>`](#change-object)

Returns a new `GameTree` instance that applies the given `changes` to the current `tree`.

#### `tree.reset([changeId])`

- `changeId` `<Primitive>` *(optional)*

Returns a new `GameTree` instance that represents the tree state at the [change](#change-object) in the history of `tree` with the given `changeId`.

If `changeId` is not given, it returns a new `GameTree` instance that represents the tree state at the very beginning of the tree history.

This operation does not destroy the previous history.

---

### `class Draft`

#### Differences to [@sabaki/immutable-gametree `Draft`](https://github.com/SabakiHQ/immutable-gametree#class-draft)

- Functions prefixed with `UNSAFE_` will throw errors.
- `updateProperty`, `addToProperty`, `removeFromProperty` will throw errors for [collaborative text properties](#collaborative-text-properties).

#### `draft.id`

`<Primitive>` - The `GameTree` id on which the draft is based on.

#### `draft.timestamp`

`<Number>` - The current logical timestamp.

#### `draft.updateCollaborativeTextProperty(id, property, change)`

- `id` `<Primitive>`
- `property` `<String>`
- `change` `<Object> | <String>`

Updates the [collaborative text property](#collaborative-text-property) of the node with the given `id` according to a collaborative text change object `change` of the following structure:

~~~js
{
    deletions: <Array<Number>>,
    insertions: <Array<{
        at: <Number>,
        insert: <String>
    }>>
}
~~~

For example, applying the following collaborative text change object to `"Hello World!"`

~~~js
{
    deletions: [11, 6],
    insertions: [
        {
            at: 12,
            insert: ". How are you?"
        },
        {
            at: 6,
            insert: "cruel w"
        }
    ]
}
~~~

will result in `"Hello cruel world. How are you?"`. If you specify a string as `change`, we will perform a diff between the old string and the new one, and automatically generate a minimal collaborative text change object for you in the background.

## Releated

- [immutable-gametree](https://github.com/SabakiHQ/immutable-gametree) - An immutable game tree data type.
