import { assert } from "../dev_deps.ts";
import { compare, create, equals, FracPos } from "../src/fractionalPosition.ts";

Deno.test({
  name: "Create new unanchored fractional position",
  fn() {
    const pos = create("yishn", null, null);
    assert.assertEquals<FracPos>(pos, [[0, "yishn"]]);
  },
});

Deno.test({
  name: "Create new position in between two positions",
  fn() {
    let pos = create("yishn", [[0, "yishn"]], [[5, "yishn"]]);
    assert.assertEquals<FracPos>(pos, [[1, "yishn"]]);

    pos = create("yishn", [[0, "simon"]], [[1, "yishn"]]);
    assert.assertEquals<FracPos>(pos, [[0, "simon"], [0, "yishn"]]);
  },
});

Deno.test({
  name: "Creating impossible positions should fail",
  fn() {
    assert.assertThrows(() => {
      create(
        "yishn",
        [[0, "yishn"], [1, "yishn"]],
        [[0, "yishn"], [1, "yishn"]],
      );
    });

    assert.assertThrows(() => {
      create(
        "yishn",
        [[0, "yishn"], [2, "yishn"]],
        [[0, "yishn"], [1, "yishn"]],
      );
    });
  },
});

Deno.test({
  name: "Create new position anchored on one position",
  fn() {
    let pos = create("yishn", null, [[5, "yishn"]]);
    assert.assertEquals<FracPos>(pos, [[4, "yishn"]]);

    pos = create("yishn", [[0, "simon"]], null);
    assert.assertEquals<FracPos>(pos, [[1, "yishn"]]);

    pos = create("yishn", [[0, "yishn"]], [[5, "yishn"], [0, "yishn"]]);
    assert.assertEquals<FracPos>(pos, [[5, "yishn"], [-1, "yishn"]]);

    pos = create("yishn", [[0, "yishn"], [1, "yishn"]], [[5, "yishn"]]);
    assert.assertEquals<FracPos>(pos, [[0, "yishn"], [2, "yishn"]]);
  },
});

Deno.test({
  name: "Test if two positions are equal or not",
  fn() {
    assert.assert(equals([[0, "yishn"]], [[0, "yishn"]]));
    assert.assert(!equals(null, [[0, "yishn"]]));
    assert.assert(!equals([[0, "yishn"]], null));
    assert.assert(equals(null, null));
    assert.assert(!equals([[0, "yishn"]], [[1, "yishn"]]));
    assert.assert(!equals([[0, "simon"]], [[0, "yishn"]]));
    assert.assert(!equals([[0, "yishn"], [0, "yishn"]], [[0, "yishn"]]));
  },
});

Deno.test({
  name: "Compare two positions of same level",
  fn() {
    assert.assertEquals(compare([[0, "yishn"]], [[1, "yishn"]]), -1);
    assert.assertEquals(compare([[1, "yishn"]], [[0, "yishn"]]), 1);
    assert.assertEquals(compare([[0, "yishn"]], [[0, "simon"]]), 1);
  },
});

Deno.test({
  name: "Compare two positions of different levels",
  fn() {
    assert.assertEquals(
      compare([[0, "yishn"]], [[0, "yishn"], [0, "yishn"]]),
      -1,
    );
    assert.assertEquals(
      compare([[0, "yishn"]], [[0, "yishn"], [-1, "yishn"]]),
      -1,
    );
  },
});
