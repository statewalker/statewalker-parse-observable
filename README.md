# @statewalker/parse-observable
## Parser for ObservableHQ Cells

This module contains compiler code for ObservableHQ cells.

Code processing works in two steps. At first step ("parsing") text code is transformed to a JSON object with cell functons serialized as a plain text. At the next step ("compilation") the JSON description is compiled to real executable code. This separation of steps allows to serialize/deserialize JSON cell descriptions and generate plain javascript for notebooks. Which is very useful for notebooks compilation on the server-side in Node.

## First Stage: Parsing

```js

import { parse } from "@statewalker/parse-observable";

// Cells sources
const sources = [
  `message = "Hello, world!"`,
  `element = {
      const div = document.createElement("div");
      div.innerHTML = message;
      return div;
   }`
]

// Get a list of all cell javascript sources
const cells = parse(sources);

// Output:
[
  {
    "type": "cell",
    "name": "message",
    "references": [],
    "code": 'function message() {\nreturn ("Hello, world!");\n}',
  },
  {
    "type": "cell",
    "name": "element",
    "references": [ "message" ],
    "code":
      `function element(message) {
      const div = document.createElement("div");
      div.innerHTML = message;
      return div;
      }`,
  },
]
```

## Second Stage: Compilation


```js
import { parse, newCompiler } from "@statewalker/parse-observable";
import { Runtime } from "@observablehq/runtime";

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
const value = await compiled.value("myA");
console.log(value);
// Output: "Hello, world!"

```