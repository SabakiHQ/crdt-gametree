const {encodeNumber, compareLexically} = require('./helper')

const compareId = compareLexically(compareLexically())
const equalsId = id1 => id2 => compareId(id1, id2) === 0

class CollaborativeText {
    constructor(id, initString = '') {
        let characters = Array.from(initString)

        this.id = id
        this.getTimestamp = ((counter = 0) => () => encodeNumber(++counter))()
        this.data = characters.map((char, i) => ({
            id: [[i, "r", this.getTimestamp()]],
            value: char
        }))
    }

    _getIdBetween(id1, id2) {
        let timestamp = this.getTimestamp()

        if (id1 == null && id2 == null) {
            return [[0, this.id, timestamp]]
        }

        if (id1 != null && id2 != null && id1.length === id2.length) {
            let [lastFragment1] = id1.slice(-1)
            let [lastFragment2] = id2.slice(-1)

            if (lastFragment2[0] - lastFragment1[0] > 1) {
                return [...id1.slice(0, -1), [lastFragment1[0] + 1, this.id, timestamp]]
            } else {
                return [...id1, [0, this.id, timestamp]]
            }
        } else {
            let anchorId = id1 == null ? id2
                : id2 == null ? id1
                : id1.length > id2.length ? id1 : id2

            let [lastFragment] = anchorId.slice(-1)
            let position = anchorId === id1 ? 1 : -1

            return [...anchorId.slice(0, -1), [lastFragment[0] + position, this.id, timestamp]]
        }
    }

    _getIdsBetween(id1, id2, length) {
        let id = this._getIdBetween(id1, id2)

        if (length === 0) return []
        if (length === 1) return [id]

        return [...Array(length)].map(_ =>
            [...id.slice(0, -1), [...id.slice(-1)[0].slice(0, -1), this.getTimestamp()]]
        )
    }

    _getIndexFromId(id, {startIndex = 0, endIndex = this.data.length} = {}) {
        let stringify = JSON.stringify
        let key = stringify(id)

        if (this._idMapCache == null) this._idMapCache = {}
        if (this.data.length === 0) return null

        if (this._idMapCache[key] == null) {
            // Look for index with binary search

            let found = null

            while (endIndex - startIndex >= 1) {
                let index = Math.floor(startIndex + (endIndex - startIndex) / 2)
                let compare = compareId(id, this.data[index].id)

                this._idMapCache[stringify(this.data[index].id)] = index

                if (compare < 0) {
                    endIndex = index
                } else if (compare > 0) {
                    startIndex = index + 1
                } else {
                    found = index
                    break
                }
            }

            this._idMapCache[key] = found != null ? found : endIndex
        }

        return this._idMapCache[key]
    }

    getIdFromIndex(index) {
        return this.data[index] == null ? null : this.data[index].id
    }

    applyChange({deletions = [], insertions = []}) {
        if (deletions.length === 0 && insertions.length === 0) return this

        let newData = [...this.data]

        // Handle inserts

        let offset = 0

        insertions.sort(({at: x}, {at: y}) => x == null ? 1 : y == null ? -1 : compareId(x, y))

        for (let insertion of insertions) {
            let {insert, ids} = insertion
            let insertIndex

            if (insert.length === 0) continue

            insert = [...insert]

            if (ids == null) {
                let id2 = insertion.at
                let index2 = id2 == null ? this.data.length : this._getIndexFromId(id2)
                let char1 = this.data[index2 - 1]
                let id1 = char1 == null ? null : char1.id
                let newIds = this._getIdsBetween(id1, id2, insert.length)

                insertion.ids = ids = newIds
                insertIndex = index2 + offset
            } else {
                let index2 = this._getIndexFromId(ids.slice(-1)[0])
                insertIndex = index2 + offset
            }

            newData.splice(insertIndex, 0, ...insert.map((value, i) => ({
                id: ids[i],
                value
            })))

            offset += insert.length
        }

        // Handle deletions

        if (deletions.length > 0) {
            newData = newData.filter(({id}) => !deletions.some(equalsId(id)))
        }

        let result = new CollaborativeText(this.id)
        result.getTimestamp = this.getTimestamp
        result.data = newData

        return result
    }

    toString() {
        return this.data.reduce((acc, x) => acc + x.value, '')
    }

    valueOf() {
        return this.toString()
    }

    toJSON() {
        return this.valueOf()
    }
}

module.exports = CollaborativeText
