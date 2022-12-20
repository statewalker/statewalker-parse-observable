# @statewalker/parse-observable
## Parser for ObservableHQ Cells

This module contains compiler code for ObservableHQ cells.

Code processing works in two steps. At first step ("parsing") text code is transformed to a JSON object with cell functons serialized as a plain text. At the next step ("compilation") the JSON description is compiled to real executable code. This separation of steps allows to serialize/deserialize JSON cell descriptions and generate plain javascript for notebooks. Which is very useful for notebooks compilation on the server-side in Node.

Methods defined in this module:

* `parse(code, options)` - parses individual ObservableHQ cells and returns a list of sources for JavaScript functions with associated information (name, dependencies etc); this list can be easily serialized and used later without access to the Observable parser
* `newCompiler(cells,call)` - returns a function transforming compiled code to an ObservableHQ runtime module

## `parse(code, options)`

This metdhod parses the given code and returns an array of cells definitions with plain JavaScript code.
The resulting cells can be serialized to JSON and used later without access to the ObservableHQ parser.

Parameters:
* `code` - string | Array<string> - code for one or multiple ObservableHQ cells
* `options` - options applied directly  to the @observablehq/parse#[parseCell](https://github.com/observablehq/parser#parseCell) method

This method returns compiled cells in the following format: 
`{ type : "import" | "cell", ... }`

`import` cells have the following fields:
* `type="import"`
* `source` - source of the import
* `specifiers` - list of imported variables
* `injections` - list of variables to re-define in the imported module

Each entry in the `imported` or `injected` arrays has the following structure:
* `name` - name of the variable (cell) in the imported module
* `alias` - name of the imported variable in this module; it "overloads" the name for the imported variables
Very often the `name` and `alias` are the same which means that cells in the local and imported modules have the same name.


`cell` items have the following fields:
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

## `newCompiler(options) / compile(cells, call)`

Returns a new async function compiling cells to ObservableHQ runtime modules.

Parameters:
* `options` - list of options used to compile cells
* `options.runtime` - mandatory [ObservableHQ Runtime](https://github.com/observablehq/runtime#Runtime) instance
* `options.observer` - mandatory [ObservableHQ Observer](https://github.com/observablehq/runtime#observers) instance controlling how cells execution results interact with the context (with the host notebooks)
* `options.resolve` - an async method instantiating imported modules; this method recieves the following parameters: 
  - `source` - reference to the imported module
  - `runtime` - the current [ObservableHQ Runtime](https://github.com/observablehq/runtime#Runtime)
  - `observer` - the current [ObservableHQ Observer](https://github.com/observablehq/runtime#observers) function 
* `options.module` - optional [ObservableHQ Module](https://github.com/observablehq/runtime#modules) instance where cells defintions should be added; if this variable is not defined then this method creates a default module


The `newCompiler(...)` method returns a function allowing to transform code cells to ready-to-use [ObservableHQ Modules](https://github.com/observablehq/runtime#modules).

It accepts two parameters:
* `cells`  - list of cells as it was returned by the `parse` method ("import" and "cell" elements)
* `callCell` - an optional method used to invoke the cell function; it can be used to re-define the context object for cells (redefine 'this'); it recieves an object with the following fields:
  - `method` - the cell method to call
  - `args` - cell parameters 
  - `cell` - the cell definition 
  - `module` - the current ObservableHQ Module
  - `runtime` - the current ObservableHQ Runtime instance
  - `variable` - the current ObservableHQ Variable 

Returns a resolved ready-to-use [ObservableHQ Module](https://github.com/observablehq/runtime#modules).

```js

// This method is responsible for calling individual cell methods.
// It can re-define the context ('this') of these methods.
const callCell = ({ method, args, }) => method.call(this, args);

const compile = newCompiler({
  resolve : async ({ source, runtime, obsever }) => {  // Resolve imported modules
    // Read cells of the imported module somewhere
    const cells = await loadCells(source); 
    // Transform cells of the imported module to an ObservableHQ module
    return await compile(cells, callCell);
  },
  runtime: new Runtime(new Library),
  observer: new Inspector(document.querySelector("#hello")), 
})

const cells = ...
const module = await compile(cells, callCell);
```


Example:
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
const context = {};
const compiled = await compile(cells);
const value = await compiled.value("myA");
console.log(value);
// Output: "Hello, world!"

```