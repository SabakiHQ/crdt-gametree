class TextCrdt {
    constructor(id, initString = '') {
        let characters = Array.from(initString)

        this.id = id
        this.data = [
            {
                parent: null,
                author: null,
                id: [0],
                value: null,
                children: []
            },
            ...characters.map((char, i) => ({
                parent: null,
                author: id,
                id: [i + 1],
                value: char,
                children: []
            }))
        ]
    }

    *listCharacters() {
        function* inner(node) {
            yield node

            for (let child of node.children) {
                yield* inner(child)
            }
        }

        for (let char of this.data) {
            if (char.value == null) continue
            yield* inner(char)
        }
    }

    getIdsFromIndices(indices) {
        let maxIndex = Math.max(...indices)
        let ids = []

        for (let char of this.listCharacters()) {
            ids.push(char.id)
            if (ids.length > maxIndex) break
        }

        return indices.map(i => ids[i])
    }

    getCharacter(id) {
        let char = this.data[id[0]]

        for (let i = 1; i < id.length; i++) {
            char = char.children[id[i]]
        }

        return char
    }

    applyChange({delete: deleteIndices, inserts}) {
        let result = new TextCrdt(this.id)

        // TODO

        return result
    }
}

module.exports = TextCrdt
