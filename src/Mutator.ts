import type { GameTree } from "./GameTree.ts";
import type { MutateResult } from "./types.ts";

export class Mutator {
  constructor(private tree: GameTree, private result: MutateResult) {}
}
