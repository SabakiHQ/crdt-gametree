import { Enum } from "../deps.ts";
import { Change, extendWithAuthorTimestamp } from "./Change.ts";
import { createPosition } from "./fractionalPosition.ts";
import type { GameTree } from "./GameTree.ts";
import type { Id, Key, MutateResult } from "./types.ts";

export class Mutator {
  result: MutateResult = {
    changes: [],
    inverseChanges: [],
  };

  constructor(private tree: GameTree) {}

  private _applyChange(timestamp: number, change: Change): boolean {
    const timestampedChange = extendWithAuthorTimestamp(change, {
      author: this.tree.author,
      timestamp: timestamp,
    });

    const inverseChange = Enum.match<Change, Change | null>(change, {
      AppendNode: (data) => {
        const metaNode = this.tree.toJSON().metaNodes[data.id];
        if (metaNode != null) return null;

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
      this.result.inverseChanges.push(inverseChange);
      this.tree.applyChange(timestampedChange);

      return true;
    }

    return false;
  }

  applyChange(change: Change): boolean {
    return this._applyChange(this.tree.tick(), change);
  }

  appendNode(parent: Id, key?: Key): Id | null {
    const parentNode = this.tree.get(parent);
    if (parentNode == null) return null;

    const timestamp = this.tree.tick();
    const id = `${this.tree.author}-${timestamp}` as Id;
    const rightMostSibling = parentNode.children().slice(-1)[0]?.id;
    const beforePos = rightMostSibling == null
      ? null
      : this.tree.toJSON().metaNodes[rightMostSibling]?.position.value ?? null;

    const success = this._applyChange(
      timestamp,
      Change.AppendNode({
        id,
        key,
        parent,
        position: createPosition(this.tree.author, beforePos, null),
      }),
    );

    return success ? id : null;
  }

  deleteNode(id: Id): boolean {
    return this.applyChange(Change.UpdateNode({
      id,
      deleted: true,
    }));
  }

  shiftNode(id: Id, direction: "left" | "right" | "main"): boolean {
    const node = this.tree.get(id);
    if (node == null) return false;
    if (node.parent == null) return true;

    const siblings = node.parent.children();
    const siblingPositions = siblings
      .map((sibling) =>
        this.tree.toJSON().metaNodes[sibling.id]?.position.value
      );

    const index = siblings.findIndex((sibling) => sibling.id === id);
    const beforeIndex = direction === "left"
      ? index - 2
      : direction === "right"
      ? index + 1
      : -1;
    const afterIndex = beforeIndex + 1;
    const beforePos = siblingPositions[beforeIndex] ?? null;
    const afterPos = siblingPositions[afterIndex] ?? null;

    return this.applyChange(Change.UpdateNode({
      id,
      position: createPosition(this.tree.author, beforePos, afterPos),
    }));
  }

  private updatePropertyValue(
    id: Id,
    prop: string,
    value: string,
    deleted: boolean,
  ): boolean {
    return this.applyChange(Change.UpdatePropertyValue({
      id,
      prop,
      value,
      deleted,
    }));
  }

  addToProperty(id: Id, prop: string, value: string): boolean {
    return this.updatePropertyValue(id, prop, value, false);
  }

  removeFromProperty(id: Id, prop: string, value: string): boolean {
    return this.updatePropertyValue(id, prop, value, true);
  }

  updateProperty(id: Id, prop: string, values: string[]): boolean {
    return this.applyChange(Change.UpdateProperty({
      id,
      prop,
      values,
    }));
  }

  removeProperty(id: Id, prop: string): boolean {
    return this.updateProperty(id, prop, []);
  }
}
