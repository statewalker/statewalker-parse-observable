# @statewalker/parse-observable
## Parser for ObservableHQ Cells

This module contains compiler code for ObservableHQ cells.

Code processing works in two steps. At first step ("parsing") text code is transformed to a JSON object with cell functons serialized as a plain text. At the next step ("compilation") the JSON description is compiled to real executable code. This separation of steps allows to serialize/deserialize JSON cell descriptions and generate plain javascript for notebooks. Which is very useful for notebooks compilation on the server-side in Node.

## First Stage: Parsing

```js

import { parse, tree } from "@statewalker/parse-observable";

const cells = [
  `message = "Hello, world!"`,
  `element = {
      const div = document.createElement("div");
      div.innerHTML = message;
      return div;
   }`
]

// Listener is used to notify about individual cells
const listener = new tree.CodeTreeBuilder();

// Parse cells and notify about individual cells.
parse.parseObservableCell(test.source, listener);

// Get the module containing all cells
const module = listener.result;

// Now this module can be serialized and/or used to compile cells code

```

## Second Stage: Compilation


```js

import { parse, compile } from "@statewalker/parse-observable";
import CompilingListener from "../src/compile/CompilingListener.js";
import { Runtime } from "@observablehq/runtime";

// Create an ObservableHQ Runtime instance.
// It will control the behaviour and dependencies between cells.
const runtime = new Runtime();

const observer = () => true; // Just to be sure that all cells are evaluated
const listener = new CompilingListener({
  runtime,
  observer,
});

// Parse the  module or deserialize it. See the previous step.
const module = ...; 

// Execute the module and get the content of the "element" cell
const compiled = await listener.finalize(() => {});
const div = await compiled.value("element");
document.appendChild(div);

```