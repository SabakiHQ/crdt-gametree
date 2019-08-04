const {compare} = require('./helper')

class ImmutableSortedSet {
    constructor({data = null, cmp = null} = {}) {
        this.length = data == null ? 0 : data.index + 1
        this.data = data
        this.cmp = cmp || compare
    }

    push(values) {
        if (values.length === 0) return this

        let afterValues = []
        let baseData = null

        values = values.slice()
        values.sort(this.cmp)

        for (let itemData of this._reverseIterData()) {
            while (
                values.length > 0
                && this.cmp(values[values.length - 1], itemData.value) > 0
            ) {
                afterValues.push(values.pop())
            }

            if (values.length === 0) {
                baseData = itemData
                break
            }

            afterValues.push(itemData.value)
        }

        for (let value of values.reverse()) {
            afterValues.push(value)
        }

        // Deduplicate data

        afterValues = afterValues
            .filter((x, i, a) => i === 0 || this.cmp(a[i - 1], x) !== 0)
            .reverse()

        // Create new object

        let newData = afterValues.reduce((acc, value) => ({
            index: acc == null ? 0 : acc.index + 1,
            value,
            previous: acc
        }), baseData)

        return new ImmutableSortedSet({
            data: newData,
            cmp: this.cmp
        })
    }

    peek() {
        return this.data == null ? null : this.data.value
    }

    *_reverseIterData() {
        let item = this.data

        while (item != null) {
            yield item
            item = item.previous
        }
    }

    *reverseIter() {
        for (let item of this._reverseIterData()) {
            yield item.value
        }
    }

    *reverseEnumerate() {
        for (let item of this._reverseIterData()) {
            yield [item.index, item.value]
        }
    }

    reverseFind(predicate) {
        for (let value of this.reverseIter()) {
            if (predicate(value)) return value
        }

        return null
    }

    toJSON() {
        let result = [...this.reverseIter()]
        result.reverse()

        return result
    }
}

module.exports = ImmutableSortedSet
