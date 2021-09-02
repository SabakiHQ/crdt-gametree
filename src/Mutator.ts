import { Enum } from "../deps.ts";
import { Change, extendWithAuthorTimestamp } from "./Change.ts";
import type { GameTree } from "./GameTree.ts";
import type { MutateResult } from "./types.ts";

export class Mutator {
  constructor(private tree: GameTree, private result: MutateResult) {}

  applyChange(change: Change): this {
    const timestampedChange = extendWithAuthorTimestamp(change, {
      author: this.tree.author,
      timestamp: this.tree.tick(),
    });

    const inverseChange = Enum.match<Change, Change | null>(change, {
      AppendNode: (data) => {
        return Change.UpdateNode({
          id: data.id,
          deleted: true,
        });
      },
      UpdateNode: (data) => {
        const metaNode = this.tree.toJSON().metaNodes[data.id];
        if (metaNode == null) return null;

        return Change.UpdateNode({
          id: data.id,
          deleted: !!metaNode.deleted?.value,
          position: metaNode.position.value,
        });
      },
      UpdateProperty: (data) => {
        const metaNode = this.tree.toJSON().metaNodes[data.id];
        if (metaNode == null) return null;

        const oldValues = metaNode.props?.[data.prop]?.values
          .filter((metaPropValue) => !metaPropValue.deleted)
          .map((metaPropValue) => metaPropValue.value) ?? [];

        return Change.UpdateProperty({
          id: data.id,
          prop: data.prop,
          values: oldValues,
        });
      },
      UpdatePropertyValue: (data) => {
        const metaNode = this.tree.toJSON().metaNodes[data.id];
        if (metaNode == null) return null;

        return Change.UpdatePropertyValue({
          id: data.id,
          prop: data.prop,
          value: data.value,
          deleted: metaNode.props?.[data.prop]?.values
            .find((metaPropValue) => metaPropValue.value === data.value)
            ?.deleted ?? true,
        });
      },
    });

    if (inverseChange != null) {
      this.result.changes.push(timestampedChange);
      this.result.inverseChanges.unshift(inverseChange);

      this.tree.applyChange(timestampedChange);
    }

    return this;
  }
}
