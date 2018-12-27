class ImmutableArray {
    constructor(data = null) {
        this.length = data == null ? 0 : data.index + 1
        this.data = data
    }

    push(value) {
        return new ImmutableArray({
            index: this.length,
            value,
            previous: this.data
        })
    }

    pop() {
        if (this.data == null) return null
        return new ImmutableArray(this.data.previous)
    }

    peek() {
        if (this.data == null) return null
        return this.data.value
    }

    splice(index, removeCount, ...values) {
        let prevData = this.data

        for (let item of this._reverseIterData()) {
            if (item.index >= index + removeCount) {
                values.push(item.value)
            }

            if (item.index < index) {
                prevData = item
                break
            }
        }

        return values.reduce((acc, x) => acc.push(x), new ImmutableArray(prevData))
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
        for (let [i, value] of this._reverseIterData()) {
            if (i === index) {
                return value
            }
        }

        return null
    }

    find(predicate) {
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

module.exports = ImmutableArray
