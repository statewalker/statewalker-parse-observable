import { default as expect } from "expect.js";
import { newCompiler, parse } from "../src/index.js";
import { Runtime } from "@observablehq/runtime";

describe("compileModule", () => {
  it("should compile module cells", async () => {
    const cells = parse([
      `mutable myA = 'aa'`,
      `{ mutable myA = 'Hello, world!' }`,
    ]);
    const compile = newCompiler({
      resolve: () => {},
      runtime: new Runtime(),
      observer: () => true, // Just to be sure that all cells are evaluated
    });

    const compiled = await compile(cells);
    expect(typeof compiled).to.be("object");
    const value = await compiled.value("myA");
    expect(value).to.eql("Hello, world!");
  });
});
