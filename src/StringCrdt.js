const {compareLexically} = require('./helper')

const compareId = compareLexically(compareLexically())
const equalsId = id1 => id2 => compareId(id1, id2) === 0

class StringCrdt {
    constructor(id, initString = '') {
        let characters = Array.from(initString)

        this.id = id
        this.data = characters.map((char, i) => ({
            id: [[i, id]],
            value: char
        }))
    }

    _getIdBetween(id1, id2) {
        if (id1 == null && id2 == null) {
            return [[0, this.id]]
        }

        if (id1 != null && id2 != null && id1.length === id2.length) {
            let [lastFragment1] = id1.slice(-1)
            let [lastFragment2] = id2.slice(-1)

            if (lastFragment2[0] - lastFragment1[0] > 1) {
                return [...id1.slice(0, -1), [lastFragment1[0] + 1, this.id]]
            } else {
                return [...id1, [0, this.id]]
            }
        } else {
            let anchorId = id1 == null ? id2
                : id2 == null ? id1
                : id1.length > id2.length ? id1 : id2

            let [lastFragment] = anchorId.slice(-1)
            let position = anchorId === id1 ? 1 : -1

            return [...anchorId.slice(0, -1), [lastFragment[0] + position, this.id]]
        }
    }

    _getIndexFromId(id) {
        let stringify = JSON.stringify
        let key = stringify(id)

        if (this._idMapCache == null) this._idMapCache = {}
        if (this.data.length === 0) return null

        if (this._idMapCache[key] == null) {
            // Look for index with binary search

            let startIndex = 0
            let endIndex = this.data.length - 1

            while (startIndex <= endIndex) {
                let index = Math.floor(startIndex + (endIndex - startIndex) / 2)
                let compare = compareId(id, this.data[index].id)

                this._idMapCache[stringify(this.data[index].id)] = index

                if (compare < 0) {
                    endIndex = index - 1
                } else if (compare > 0) {
                    startIndex = index + 1
                } else {
                    break
                }
            }
        }

        return this._idMapCache[key]
    }

    applyChange({delete: deleteIds, inserts}) {
        let newData = [...this.data]

        // Handle inserts

        for (let {at: id2, insert} of inserts) {
            let index2 = id2 == null ? this.data.length : this._getIndexFromId(id2)
            let char1 = this.data[index2 - 1]
            let id1 = char1 == null ? null : char1.id

            let newIds = insert.reduce((ids, value, i) => {
                ids.push(this._getIdBetween(ids[i - 1] || id1, id2))
                return ids
            }, [])

            newData.splice(index2, 0, ...insert.map((value, i) => ({
                id: newIds[i],
                value
            })))
        }

        // Handle deletions

        newData = newData.filter(({id}) => !deleteIds.some(equalsId(id)))

        let result = new StringCrdt(this.id)
        result.data = newData

        return result
    }

    toString() {
        return this.data.reduce((acc, x) => acc + x.value, '')
    }

    toJSON() {
        return this.toString()
    }
}

module.exports = StringCrdt
