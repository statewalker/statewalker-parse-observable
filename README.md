# @statewalker/parse-observable
## Parser for ObservableHQ Cells

This module contains compiler code for ObservableHQ cells.

Code processing works in two steps. At first step ("parsing") text code is transformed to a JSON object with cell functons serialized as a plain text. At the next step ("compilation") the JSON description is compiled to real executable code. This separation of steps allows to serialize/deserialize JSON cell descriptions and generate plain javascript for notebooks. Which is very useful for notebooks compilation on the server-side in Node.

Methods defined in this module:

* `parse(code, options)` - parses individual ObservableHQ cells and returns a list of sources for JavaScript functions with associated information (name, dependencies etc); this list can be easily serialized and used later without access to the Observable parser
* `compile({ cells, runtime, observer, module? })` - returns an object with Observable runtime module and variables

## `parse(code, options)`

This metdhod parses the given code and returns an array of cells definitions with plain JavaScript code.
The resulting cells can be serialized to JSON and used later without access to the ObservableHQ parser.

Parameters:
* `code` - string | Array<string> - code for one or multiple ObservableHQ cells
* `options` - options applied directly  to the @observablehq/parse#[parseCell](https://github.com/observablehq/parser#parseCell) method

This method returns compiled cells in the following format: 
`{ type : "import" | "cell", ... }`

**`import` items:**

* `type="import"`
* `source` - source of the import
* `specifiers` - list of imported variables
* `injections` - list of variables to re-define in the imported module

Each entry in the `imported` or `injected` arrays has the following structure:
* `name` - name of the variable (cell) in the imported module
* `alias` - name of the imported variable in this module; it "overloads" the name for the imported variables
Very often the `name` and `alias` are the same which means that cells in the local and imported modules have the same name.

**`cell` items:**
* `type="cell"`
* `name` - name of the cell (variable); example: `viewof ${name}`
* `references` - list of variables used in this cells; these variables should be provided by the runtime; it could be other cells from this notebook or global variables
* `code` - plain compiled javascript
* `constants` - list of "constants" used in this cell; it could be an attachment file reference (ex: `FileAttachment("AttachmentName")`) or a secret (ex: `Secret("MY_API_KEY")`)

Example:
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

## `compile({ cells, runtime, observer, module?, })`

This method compiles the specified set of cells to a module and returns an object containing the ObservableHQ module and a list of variables.

Parameters:
 * `options` - contains methods used by this function
 * `options.cells` - list of serialized ObservableHQ cells returned by the `parse` method
 * `options.runtime` - the [ObservableHQ Runtime](https://github.com/observablehq/runtime#Runtime) used to create modules and variables
 * `options.observer` - the [ObservableHQ Observer](https://github.com/observablehq/runtime#observers) function returning instances tracking the lifecycle of individual variables (should contain "pending"/"fulfilled"/"rejected" methods)
 * `options.module` [optional] - an [ObservableHQ Module](https://github.com/observablehq/runtime#modules) instance containing the returned variables; if this parameter is not defined then this method will create a new module
 * `options.resolve` [optional] - this async method should resolve the specified import and return the corresponding ObservableHQ Module; default function: {@link #resolveImportSource}
 * `options.compileCell` [optional] - this function compiles the code of the given cell; by default it is the {@link #compileCellCode} function
 * `options.formatImport` [optional] - this method formats the specified import cell to visualize import in the main module; by default it uses the {@link #formatImportCell} method.

 This method returns a `Promise` resolving to an object with the following fields:
 * "variables" - list of [ObservableHQ Variable](https://github.com/observablehq/runtime#variables) instances
 * "module" - [ObservableHQ Module](https://github.com/observablehq/runtime#modules) used to create variables; if the "module" parameter for this function was defined then it is the same instance


```js
import { Runtime, Inspector } from "@observablehq/parser";
import { parse, compile, resolveImportSource, compileCellCode } from "@statewalker/parse-observable";

// This method is responsible for calling individual cell methods.
// It can re-define the context ('this') of these methods.
const cells = parse([`...code source...`]);
const observer = (name) => {
  let elm = document.querySelector('#' + name);
  if (!elm) {
    elm = document.createElement("div");
    document.body.appendChild(elm);
  }
  return new Inspector(elm);
}; 
const { module, variables } = await compile({
  cells,                          // Parsed cells
  observer,                       // Observer attaching cells to DOM
  runtime: new Runtime(),         // ObservableHQ Runtime 
  compileCell : compileCellCode   // Cells code compiler; Default value
  resolve: resolveImportSource,   // Import of external notebooks; Default value
});

...
```

The `compileCell` parameter allows to re-define the default execution context for cells:

```js

const context = { ... };
const compileCell = ({ cell }) => {
  let method = new Function(`"use strict"\nreturn (${cell.code})`)();
  return (...args) => method.apply(context, args);
};

```


Example:
```js
import { parse, newCompiler } from "@statewalker/parse-observable";
import { Runtime } from "@observablehq/runtime";

const cells = parse([
  `mutable myA = 'aa'`,
  `{ mutable myA = 'Hello, world!' }`,
]);
const context = { };
const { variables, module } = compile({
  cells,
  resolve: () => {},
  runtime: new Runtime(),
  observer: () => true, // Just to be sure that all cells are evaluated
  compileCell : ({ cell }) => {
    let method = new Function(`"use strict"\nreturn (${cell.code})`)();
    return (...args) => method.apply(context, args);
  },
});
const value = await compiled.value("myA");
console.log(value);
// Output: "Hello, world!"
```