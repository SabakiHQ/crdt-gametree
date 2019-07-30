const t = require('tap')
const StringCrdt = require('../src/StringCrdt')

t.test('constructor', async t => {
    let str1 = new StringCrdt(1)

    t.equal(str1.valueOf(), '')

    let str2 = new StringCrdt(1, 'Hello World!')

    t.equal(str2.valueOf(), 'Hello World!')
})

t.test('delete', async t => {
    let str = new StringCrdt(1, 'Helllo Worrld!')
    let ids = [2, 10].map(i => str.getIdFromIndex(i))
    let str2 = str.applyChange({deletions: ids})

    t.equal(str2.valueOf(), 'Hello World!')
})

t.test('insert', async t => {
    let str = new StringCrdt(1, 'Helo World!')
    let str2 = str.applyChange({insertions: [
        {
            at: str.getIdFromIndex(3),
            insert: ['l']
        },
        {
            at: null,
            insert: [...' How are you?']
        },
        {
            at: str.getIdFromIndex(str.valueOf().indexOf('!')),
            insert: [...', Yichuan']
        }
    ]})

    t.equal(str2.valueOf(), 'Hello World, Yichuan! How are you?')
})

t.test('multi level insert', async t => {
    let str = new StringCrdt(1, 'Hello World!')
    let str2 = str.applyChange({insertions: [
        {
            at: str.getIdFromIndex(str.valueOf().indexOf('W')),
            insert: [...'cruel ']
        }
    ]})

    t.equal(str2.valueOf(), 'Hello cruel World!')

    let str3 = str2.applyChange({insertions: [
        {
            at: str2.getIdFromIndex(str2.valueOf().indexOf('uel')),
            insert: [...'ime-filled and cr']
        }
    ]})

    t.equal(str3.valueOf(), 'Hello crime-filled and cruel World!')
})

t.test('delete and insert', async t => {
    let str = new StringCrdt(1, 'Hwlllo World!')
    let str2 = str.applyChange({
        deletions: [1, 2].map(i => str.getIdFromIndex(i)),
        insertions: [
            {
                at: str.getIdFromIndex(2),
                insert: ['e']
            },
            {
                at: str.getIdFromIndex(str.valueOf().indexOf('!')),
                insert: [...', Yichuan']
            }
        ]
    })

    t.equal(str2.valueOf(), 'Hello World, Yichuan!')
})

t.test('conflict-free', async t => {
    let initChange = {insertions: [{at: null, insert: [...'hlllo world']}]}

    let str1 = new StringCrdt(1).applyChange(initChange)
    let str2 = new StringCrdt(2).applyChange(initChange)

    let change1 = {
        deletions: [str1.getIdFromIndex(1)],
        insertions: [{at: str1.getIdFromIndex(1), insert: ['e']}]
    }

    let fix1 = str1.applyChange(change1)

    t.equal(fix1.valueOf(), 'hello world')

    let change2 = {
        deletions: [str2.getIdFromIndex(1)],
        insertions: [
            {
                at: str2.getIdFromIndex(str2.valueOf().indexOf('w')),
                insert: [...'cruel ']
            },
            {
                at: null,
                insert: ['!']
            }
        ]
    }

    let fix2 = str2.applyChange(change2)

    t.equal(fix2.valueOf(), 'hllo cruel world!')

    let merged1 = str1.applyChange(change1).applyChange(change2)
    let merged2 = str2.applyChange(change2).applyChange(change1)

    t.equal(merged1.valueOf(), 'hello cruel world!')
    t.equal(merged1.valueOf(), merged2.valueOf())
})
