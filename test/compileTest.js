import { default as expect } from "expect.js";
import { compile, parse } from "../src/index.js";
import { Runtime } from "@observablehq/runtime";

describe("compile()", () => {
  it("should compile module cells", async () => {
    const cells = parse([
      `mutable myA = 'aa'`,
      `{ mutable myA = 'Hello, world!' }`,
    ]);

    const { module, variables } = await compile({
      cells,
      resolve: () => {},
      runtime: new Runtime(),
      observer: () => true, // Just to be sure that all cells are evaluated
    });
    expect(Array.isArray(variables)).to.be(true);
    expect(variables.length).to.be(4);
    expect(typeof module).to.be("object");
    const value = await module.value("myA");
    expect(value).to.eql("Hello, world!");
  });

  it("should be able to re-define 'this' for cells", async () => {
    const cells = parse([
      `mycell = { return { message: "Hello", context : this } }`,
    ]);
    
    const context = { message : "World" }
    const { module, variables } = await compile({
      cells,
      cells,
      resolve: () => {},
      runtime: new Runtime(),
      observer: () => true, // Just to be sure that all cells are evaluated
      compileCell : ({ cell }) => {
        let method = new Function(`"use strict"\nreturn (${cell.code})`)();
        return (...args) => method.apply(context, args);
      }
    });
    expect(typeof module).to.be("object");
    const value = await module.value("mycell");
    expect(value).to.eql({
      message: "Hello",
      context
    });
    expect(value.context).to.be(context);
  });

  it("in embedded functions 'this' should be undefined", async () => {
    const cells = parse([
      `mycell = { 
        return { context : this, xContext : x() }

        function x() {
          return this;
        }
      }`,
    ]);
    const context = { message : "ABC" }
    const { module, variables } = await compile({
      cells,
      resolve: () => {},
      runtime: new Runtime(),
      observer: () => true, // Just to be sure that all cells are evaluated
      compileCell : ({ cell }) => {
        let method = new Function(`"use strict"\nreturn (${cell.code})`)();
        return (...args) => method.apply(context, args);
      }
    });
    expect(typeof module).to.be("object");
    const value = await module.value("mycell");
    expect(value).to.eql({
      context,
      xContext : undefined
    });
    expect(value.context).to.be(context);
    expect(value.xContext).to.be(undefined);
  });
});
