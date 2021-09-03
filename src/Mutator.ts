import { Enum } from "../deps.ts";
import { Change, extendChangeWithTimestamp } from "./Change.ts";
import { createPosition } from "./fractionalPosition.ts";
import type { GameTree } from "./GameTree.ts";
import type { Id, Key, MutateResult } from "./types.ts";

export class Mutator {
  result: MutateResult = {
    changes: [],
    inverseChanges: [],
  };

  /**
   * @internal
   */
  constructor(private tree: GameTree) {}

  private _applyChange(timestamp: number, change: Change): boolean {
    const timestampedChange = extendChangeWithTimestamp(change, {
      author: this.tree.author,
      timestamp: timestamp,
    });

    const inverseChange = Enum.match<Change, Change | null>(change, {
      AppendNode: (data) => {
        const metaNode = this.tree.getMetaNode(data.id);
        if (metaNode != null) return null;

        return Change.UpdateNode({
          id: data.id,
          deleted: true,
        });
      },
      UpdateNode: (data) => {
        const metaNode = this.tree.getMetaNode(data.id);
        if (metaNode == null) return null;

        return Change.UpdateNode({
          id: data.id,
          deleted: !!metaNode.deleted?.value,
          position: metaNode.position.value,
        });
      },
      UpdateRoot: (data) => {
        const metaNode = this.tree.getMetaNode(data.id);
        if (metaNode == null) return null;

        return Change.UpdateRoot({
          id: this.tree.rootId,
        });
      },
      UpdateProperty: (data) => {
        const metaNode = this.tree.getMetaNode(data.id);
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
        const metaNode = this.tree.getMetaNode(data.id);
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

  /**
   * Applies the given local change to the game tree.
   */
  applyChange(change: Change): boolean {
    return this._applyChange(this.tree.tick(), change);
  }

  /**
   * Appends a new node to the given parent. The key can be used to
   * automatically merge with any sibling node with the same key.
   * @returns The id of the new node or `null` if the change did not succeed.
   */
  appendNode(parent: Id, key?: Key): Id | null {
    const parentNode = this.tree.get(parent);
    if (parentNode == null) return null;

    const timestamp = this.tree.tick();
    const id = `${this.tree.author}-${timestamp}` as Id;
    const rightMostSibling = parentNode.children().slice(-1)[0]?.id;
    const beforePos = rightMostSibling == null
      ? null
      : this.tree.getMetaNode(rightMostSibling)?.position.value ?? null;

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

  /**
   * Deletes the node with the given id from the tree.
   * @returns `true` if change succeeded, otherwise `false`.
   */
  deleteNode(id: Id): boolean {
    if (this.tree.equalsId(id, this.tree.rootId)) return false;

    return this.applyChange(Change.UpdateNode({
      id,
      deleted: true,
    }));
  }

  /**
   * Makes the node with the given id the new root node of the tree.
   * @returns `true` if change succeeded, otherwise `false`.
   */
  updateRoot(id: Id): boolean {
    if (this.tree.equalsId(id, this.tree.rootId)) return true;

    return this.applyChange(Change.UpdateRoot({
      id,
    }));
  }

  /**
   * Changes the position of the node with the given id among its siblings.
   * @param direction - `"left"` to move the node one entry to the left,
   * `"right"` to move the node one entry to the right, `"main"` to move the
   * node to the first place.
   * @returns `true` if change succeeded, otherwise `false`.
   */
  shiftNode(id: Id, direction: "left" | "right" | "main"): boolean {
    const node = this.tree.get(id);
    if (node == null) return false;
    if (node.parent == null) return true;

    const siblings = node.parent.children();
    const siblingPositions = siblings
      .map((sibling) => this.tree.getMetaNode(sibling.id)?.position.value);

    const index = siblings.findIndex((sibling) =>
      this.tree.equalsId(sibling.id, id)
    );
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

  /**
   * Adds the given value to the specified prop of the node with the given id.
   * This will ignore duplicate values.
   * @returns `true` if change succeeded, otherwise `false`.
   */
  addToProperty(id: Id, prop: string, value: string): boolean {
    return this.updatePropertyValue(id, prop, value, false);
  }

  /**
   * Removes the given value from the specified prop of the node with the
   * given id.
   * @returns `true` if change succeeded, otherwise `false`.
   */
  removeFromProperty(id: Id, prop: string, value: string): boolean {
    return this.updatePropertyValue(id, prop, value, true);
  }

  /**
   * Sets the specified prop of the node with the given id as values.
   * @returns `true` if change succeeded, otherwise `false`.
   */
  updateProperty(id: Id, prop: string, values: readonly string[]): boolean {
    return this.applyChange(Change.UpdateProperty({
      id,
      prop,
      values,
    }));
  }

  /**
   * Removes the specified prop of the node with the given id.
   * @returns `true` if change succeeded, otherwise `false`.
   */
  removeProperty(id: Id, prop: string): boolean {
    return this.updateProperty(id, prop, []);
  }
}
