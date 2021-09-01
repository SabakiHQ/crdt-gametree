import { assert } from "../dev_deps.ts";
import { GameTree } from "../src/GameTree.ts";

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
