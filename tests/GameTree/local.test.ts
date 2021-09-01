import { assert } from "../../dev_deps.ts";
import { GameTree, Id } from "../../src/mod.ts";
import { prepareGameTree } from "./helper.ts";

Deno.test({
  name: "Create empty GameTree",
  fn() {
    const tree = new GameTree({
      author: "yishn",
    });

    assert.assertEquals<string>(tree.author, "yishn");

    const root = tree.getRoot();

    assert.assertObjectMatch(root, {
      id: "R",
      key: undefined,
      author: "yishn",
      timestamp: 0,
      level: 0,
      parent: null,
    });

    assert.assertEquals(root.isolated(), false);
    assert.assertEquals(root.children(), []);
    assert.assertEquals(root.props(), {});
  },
});

Deno.test({
  name: "Load GameTree from JSON and navigate",
  fn() {
    const tree = prepareGameTree();
    const rootId = tree.getRoot().id;

    const allNodeIds = [rootId, ...tree.descendants(rootId)];
    assert.assertEquals(allNodeIds.length, 6);

    const mainLine = [rootId, ...tree.currentDescendants(rootId)];
    assert.assertEquals(mainLine.length, 3);

    const currents = { "1": "3" as Id };
    const currentLine = [rootId, ...tree.currentDescendants(rootId, currents)];
    assert.assertEquals(currentLine.length, 4);

    const ancestors = [...tree.ancestors("5" as Id)];
    assert.assertEquals(ancestors, ["3", "1", "R"]);
  },
});
