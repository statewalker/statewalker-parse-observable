import { default as expect } from "expect.js";
import parseObservableCell from "../src/parse/parseObservableCell.js";
import CompilingListener from "../src/compile/CompilingListener.js";
import { Runtime } from "@observablehq/runtime";

describe("compileModule", () => {
  it("should compile module cells", async () => {
    const cells = [
      `
mutable myA = 'aa'
`,
      `
{
  mutable myA = 'Hello, world!'
}

`,
    ];
    const runtime = new Runtime();
    const observer = () => true; // Just to be sure that all cells are evaluated
    const listener = new CompilingListener({
      runtime,
      observer,
    });
    for (const cell of cells) {
      parseObservableCell(cell, listener);
    }
    const compiled = await listener.finalize(() => {});
    expect(typeof compiled).to.be("object");
    const value = await compiled.value("myA");
    expect(value).to.eql("Hello, world!");
  });
});
