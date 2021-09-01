import { GameTree, Id, Timestamped } from "../../src/mod.ts";

export function prepareGameTree(): GameTree {
  const author = "yishn";
  const id = (id: string): Id => id as Id;
  const timestamp = (timestamp: number): Timestamped => ({
    timestamp,
    author,
  });

  return GameTree.fromJSON({
    metaNodes: {
      "R": {
        ...timestamp(0),
        author: "R",
        id: id("R"),
        level: 0,
        position: { ...timestamp(0), author: "R", value: [[0, "R"]] },
        children: [id("1")],
      },
      "1": {
        ...timestamp(1),
        id: id("1"),
        level: 1,
        position: { ...timestamp(1), value: [[0, author]] },
        parent: id("R"),
        children: [id("2"), id("3")],
      },
      "2": {
        ...timestamp(2),
        id: id("2"),
        level: 2,
        position: { ...timestamp(2), value: [[0, author]] },
        parent: id("1"),
      },
      "3": {
        ...timestamp(3),
        id: id("3"),
        level: 2,
        position: { ...timestamp(3), value: [[1, author]] },
        parent: id("1"),
        children: [id("4"), id("5")],
      },
      "4": {
        ...timestamp(4),
        id: id("4"),
        level: 3,
        position: { ...timestamp(4), value: [[0, author]] },
        parent: id("3"),
      },
      "5": {
        ...timestamp(5),
        id: id("5"),
        level: 3,
        position: { ...timestamp(5), value: [[0, author]] },
        parent: id("3"),
      },
    },
    queuedChanges: {},
    timestamp: 5,
  }, {
    author,
  });
}
