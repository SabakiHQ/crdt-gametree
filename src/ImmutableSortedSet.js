class ImmutableSortedSet {
    constructor({data = null, cmp = null, sanitizer = null} = {}) {
        this.length = data == null ? 0 : data.index + 1
        this.data = data
        this.cmp = cmp || ((a, b) => a < b ? -1 : a > b ? 1 : 0)
        this.sanitizer = sanitizer || (x => x)
    }

    push(...values) {
        if (values.length === 0) return this

        let afterValues = []
        let baseData = null

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

        afterValues.push(...values.reverse())

        // Sanitize data

        afterValues = afterValues
            .filter((x, i, a) => i === 0 || this.cmp(a[i - 1], x) !== 0)
            .reverse()
            .map(this.sanitizer)

        // Create new object

        let newData = afterValues.reduce((acc, value) => ({
            index: acc == null ? 0 : acc.index + 1,
            value,
            previous: acc
        }), baseData)

        return new ImmutableSortedSet({
            data: newData,
            cmp: this.cmp,
            sanitizer: this.sanitizer
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

    get(index) {
        for (let [i, value] of this.reverseEnumerate()) {
            if (i === index) {
                return value
            }
        }

        return null
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
