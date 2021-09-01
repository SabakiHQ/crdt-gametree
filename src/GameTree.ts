import { Enum } from "../deps.ts";
import { Change } from "./types.ts";
import type {
  Currents,
  GameTreeJson,
  GameTreeOptions,
  Id,
  MetaNode,
  Node,
} from "./types.ts";
import { compareMap, min } from "./helper.ts";
import { compare as comparePositions } from "./fractionalPosition.ts";

const rootId: Id = "R";

export class GameTree {
  author: string;
  private timestamp: number;
  private metaNodes: Map<Id, MetaNode> = new Map();

  constructor(options: Readonly<GameTreeOptions>) {
    this.author = options.author;
    this.timestamp = options.timestamp ?? 0;

    // Create root node

    const rootNode = {
      id: rootId,
      author: this.author,
      timestamp: ++this.timestamp,
      level: 0,
    };

    this.metaNodes.set(rootId, rootNode);
  }

  *ancestors(id: Id): Generator<Id> {
    let metaNode = this.metaNodes.get(id);

    while (metaNode != null && metaNode.parent != null) {
      metaNode = this.metaNodes.get(metaNode.parent);
      if (metaNode == null || metaNode.deleted?.value === true) return;

      yield metaNode.id;
    }
  }

  *descendants(id: Id): Generator<Id> {
    // Depth first iteration of descendants

    const stack = [id];

    while (stack.length > 0) {
      const stackId = stack.pop()!;
      const metaNode = this.metaNodes.get(stackId);

      if (metaNode != null && !metaNode.deleted?.value) {
        if (stackId !== id) yield stackId;

        stack.push(...metaNode.children ?? []);
      }
    }
  }

  *currentDescendants(id: Id, currents?: Currents): Generator<Id> {
    let metaNode = this.metaNodes.get(id);

    while (
      metaNode != null &&
      metaNode.children != null &&
      metaNode.children.length > 0
    ) {
      const currentChildId = (() => {
        const currentChildId = currents?.get(metaNode.id);
        const childrenMetaNodes = metaNode.children
          .map((id) => this.metaNodes.get(id))
          .filter((metaNode): metaNode is MetaNode =>
            metaNode != null && !metaNode.deleted?.value
          );

        if (
          currentChildId != null &&
          childrenMetaNodes.some((childMetaNode) =>
            childMetaNode.id === currentChildId
          )
        ) {
          return currentChildId;
        }

        // If no current child is given, use left most child node

        return min(
          compareMap(
            (value: MetaNode) => value.position?.value ?? null,
            comparePositions,
          ),
        )(...childrenMetaNodes)?.id;
      })();

      if (currentChildId == null) break;
      yield currentChildId;

      metaNode = this.metaNodes.get(currentChildId);
    }
  }

  navigate(id: Id, step: number, currents?: Currents): Id | null {
    if (step === 0) return id;

    let lastResult: Id | null = null;

    if (step < 0) {
      for (const result of this.ancestors(id)) {
        lastResult = result;
        step++;
        if (step === 0) return result;
      }
    } else if (step > 0) {
      for (const result of this.currentDescendants(id, currents)) {
        lastResult = result;
        step--;
        if (step === 0) return result;
      }
    }

    return lastResult;
  }

  onCurrentLine(id: Id, currents?: Currents): boolean {
    const metaNode = this.metaNodes.get(id);
    if (metaNode == null) return false;
    if (metaNode.level === 0) return true;

    const currentDescendantId = this.navigate(rootId, metaNode.level, currents);
    return currentDescendantId != null && currentDescendantId === id;
  }

  get(id: Id): Node | null {
    const metaNode = this.metaNodes.get(id);
    if (metaNode == null || metaNode.deleted?.value === true) return null;

    const self = this;

    return {
      id: metaNode.id,
      key: metaNode.key,
      author: metaNode.author,
      timestamp: metaNode.timestamp,
      level: metaNode.level,

      get parent() {
        if (this._parent === undefined) {
          return this._parent = metaNode?.parent == null
            ? null
            : self.get(metaNode.parent);
        }

        return this._parent;
      },

      isolated() {
        // Find whether there is a deleted ancestor

        for (const ancestorId of self.ancestors(id)) {
          if (ancestorId === rootId) return false;
        }

        return true;
      },

      children() {
        return [...metaNode?.children ?? []]
          .sort(
            compareMap(
              (id) => self.metaNodes.get(id)?.position?.value ?? null,
              comparePositions,
            ),
          )
          .map((id) => self.get(id))
          .filter((node): node is Node => node != null);
      },

      props() {
        return Object.entries(metaNode?.props ?? {})
          .reduce((props, [name, metaPropValues]) => {
            props[name] = metaPropValues
              ?.filter((metaPropValue) => !metaPropValue.deleted?.value)
              .map((metaPropValue) => metaPropValue.value);

            return props;
          }, {} as Partial<Record<string, string[]>>);
      },
    } as Node & { _parent?: Node | null };
  }

  getRoot(): Node {
    return this.get(rootId)!;
  }

  applyChange(change: Change): this {
    Enum.match(change, {
      _: () => {
        throw new Error(`Unknown change '${Object.keys(change)[0]}' applied`);
      },
    });

    return this;
  }

  static fromJSON(
    data: GameTreeJson,
    options: Readonly<GameTreeOptions>,
  ): GameTree {
    const result = new GameTree({
      ...options,
      timestamp: data.timestamp,
    });

    result.metaNodes = new Map(Object.entries(data.metaNodes));

    return result;
  }

  toJSON(): GameTreeJson {
    return {
      timestamp: this.timestamp,
      metaNodes: Object.fromEntries(this.metaNodes),
    };
  }
}
