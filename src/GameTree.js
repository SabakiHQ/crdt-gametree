const EventEmitter = require('events')
const GameTree = require('@sabaki/immutable-gametree')
const {uuid, sha1, compareOperations} = require('./helper')

class GameTree extends EventEmitter {
    constructor({id = null, base = null, getId = null, root} = {}) {
        super()

        this.id = id == null ? uuid() : id
        this.timestamp = 0
        this.getId = getId || (() => sha1(this.id, this.timestamp++))

        this.base = base == null ? new GameTree({getId: this.getId, root}) : base
        this.root = this.base.root

        this.operations = []

        // Inherit some methods from @sabaki/immutable-gametree

        let inheritedMethods = [
            'get', 'getSequence', 'navigate',
            'listNodes', 'listNodesHorizontally', 'listNodesVertically',
            'listCurrentNodes', 'listMainNodes', 'getLevel',
            'getSection', 'getCurrentHeight', 'getHeight',
            'onCurrentLine', 'onMainLine', 'toJSON'
        ]

        for (let method of inheritedMethods) {
            this[method] = (...args) => {
                this._getGameTree()[method](...args)
            }
        }
    }

    _getGameTree() {
        if (this.operations.length > 0) {
            return this.operations.slice(-1)[0].tree
        }

        return this.base
    }
}

module.exports = GameTree
