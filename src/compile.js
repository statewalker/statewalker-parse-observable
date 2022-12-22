/**
 * This method compiles the specified set of cells to a module and returns
 * an object containing the ObservableHQ module and a list of variables
 *
 * @param {object} options - contains methods used by this function
 * @param {Array<Cell>} options.cells - list of serialized ObservableHQ cells returned by the `parse` method
 * @param {object} options.runtime - the [ObservableHQ Runtime](https://github.com/observablehq/runtime#Runtime)
 * used to create modules and variables
 * @param {object} options.observer - the [ObservableHQ Observer](https://github.com/observablehq/runtime#observers)
 * function returning instances tracking the lifecycle of individual variables
 * (should contain "pending"/"fulfilled"/"rejected" methods)
 * @param {Function} options.module [optional] - an [ObservableHQ Module](https://github.com/observablehq/runtime#modules)
 * instance containing the returned variables; if this parameter is not defined then
 * this method will create a new module
 * @param {AsyncFunction} options.resolve [optional] - this method should resolve the specified import
 * and return the corresponding ObservableHQ Module; default function: {@link #resolveImportSource}
 * @param {Function} options.compileCell [optional] - this function compiles the code of the given cell;
 * by default it is the {@link #compileCellCode} function
 * @param {Function} options.formatImport [optional] - this method formats the specified
 * import cell to visualize import in the main module; by default it uses the {@link #formatImportCell} method.
 * @return {Promise<object>} a promise to an object containing the following fields:
 * * "variables" - list of [ObservableHQ Variable](https://github.com/observablehq/runtime#variables) instances
 * * "module" - [ObservableHQ Module](https://github.com/observablehq/runtime#modules) used to create variables;
 * if the "module" parameter for this function was defined then it is the same instance
 */
export async function compile(options) {
  const cells = options.cells;
  const observer = options.observer;
  const resolve = options.resolve || resolveImportSource;
  const formatImport = options.formatImport || formatImportCell;
  const compileCell = options.compileCell || compileCellCode;
  const module = options.module || options.runtime.module();

  const variables = [];
  const imports = [];
  cells.forEach((cell) => {
    if (cell.type === "import") {
      const { specifiers, injections } = cell;
      imports.push(async () => {
        let importedModule = await resolve({ ...options, module, cell });
        if (injections.length) {
          importedModule = importedModule.derive(injections, module);
        }
        const vars = specifiers.map((specifier) => {
          const variable = module.variable(() => true);
          variable.import(
            specifier.name,
            specifier.alias,
            importedModule,
          );
          return variable;
        });
        const proxy = module.variable(observer());
        proxy.define(
          null,
          [],
          () => formatImport(cell),
        );
        const del = proxy.delete;
        proxy.delete = () => {
          console.log("proxy delete");
          vars.forEach((v) => v.delete());
          return del.apply(proxy, []);
        };
        variables.push(proxy);
      });
    } else {
      const { name, references = [] /*, constants */ } = cell;
      const variable = module.variable(observer(name));
      variable.define(
        name,
        references,
        compileCell({
          ...options,
          module,
          cell,
          variable,
        }),
      );
      variables.push(variable);
    }
  });

  for (const imp of imports) {
    await imp();
  }

  variables.forEach((variable) => {
    const del = variable.delete;
    variable.delete = (...args) => del.apply(variable, args);
  });

  return {
    module,
    variables,
  };
}

/**
 * Compiles the code of the specified cell and returns an executable JS function accepting
 * parameters and returning the content of the cell.
 *
 * @param {object} options parameters
 * @param {object} options.cell cell information
 * @param {string} options.cell.code JS code of the cell
 * @param {Array<string>} options.cell.references = [] list of dependency names
 * @param {string}  options.cell.name the name of the cell
 * @return an executable JS function
 */
export function compileCellCode(options) {
  const { cell } = options;
  let method = new Function(`"use strict"\nreturn (${cell.code})`)();
  return (...args) => method.apply(undefined, args);
}

/**
 * Returns a serialized version of the ObservableHQ import statement.
 * @param {object} cell import cell declaration
 * @param {string} cell.type the type of the import cell; it has to be "import"
 * @param {string} cell.source the URI of the module to import
 * @param {Array} cell.specifiers [{ name: string, alias?: string }] - list of imported cells
 * with their optional aliases
 * @param {string} cell.specifiers.name - the name of the cell in the imported module;
 * @param {string} cell.specifiers.alias - the alias used in the current module
 * (where the cell is injected)
 * @param {Array} cell.injections [{ name: string, alias?: string }] - list of injected cells
 * with their optional aliases
 * @param {string} cell.injections.name - the name of the cell in the current module (module which provide cells)
 * @param {string} cell.injections.alias - the alias used in the imported module (where the cell is injected)
 * @returns {string} string | DOMNode representation of the specified import
 */
export function formatImportCell(cell) {
  let chunks = ["import"];
  const specifiers = serialize(cell.specifiers);
  if (specifiers.length) {
    chunks.push("{", specifiers, "}");
  }
  const injections = serialize(cell.injections);
  if (injections.length) {
    chunks.push("with {", injections, "}");
  }
  chunks.push("from", `"${encodeURIComponent(cell.source)}"`);
  return chunks.join(" ");

  function serialize(list = []) {
    const result = [];
    for (const { name, alias } of list) {
      if (name !== alias) {
        result.push(`${name} as ${alias}`);
      } else {
        result.push(name);
      }
    }
    return result.join(", ");
  }
}

export const importModule = new Function(["url"], `return import(url);`);

/**
 * Loads the external resource referenced in the given import cell and returns the
 * resolved ObservableHQ module.
 * @param {object} cell import cell declaration
 * @param {string} cell.type the type of the import cell; it has to be "import"
 * @param {string} cell.source the URI of the module to import
 * @param {Array} cell.specifiers [{ name: string, alias?: string }] - list of imported cells
 * with their optional aliases
 * @param {string} cell.specifiers.name - the name of the cell in the imported module;
 * @param {string} cell.specifiers.alias - the alias used in the current module
 * (where the cell is injected)
 * @param {Array} cell.injections [{ name: string, alias?: string }] - list of injected cells
 * with their optional aliases
 * @param {string} cell.injections.name - the name of the cell in the current module (module which provide cells)
 * @param {string} cell.injections.alias - the alias used in the imported module (where the cell is injected)
 * @returns a resolved ObservableHQ Module corresponding to the cell source
 */
export async function resolveImportSource({ cell, runtime }) {
  const source = expandObservableHqUrl(cell.source);
  const module = await importModule(source);
  let importedModule = module.default(runtime, () => true);
  return importedModule;
}

/**
 * Transforms the specified Observable URL/ID to a observable HQ API URL.
 * @param {string} source URI/ID to resolve
 * @returns full URL returning the corresponding ObservableHQ notebook as an ESM module
 */
export function expandObservableHqUrl(source) {
  let m, name = source;
  name = name.replace(/#.*$/gim, "");
  name = name.replace(/\?.*$/gim, ""); // Strip parameters

  if ((m = /^https:\/\/observablehq.com\//i.exec(name))) {
    // https://observablehq.com/@fil/lasso-selection
    // https://observablehq.com/d/609547f6d5a0d1ca
    name = name.slice(m[0].length);
  } else if (
    (m = /^https:\/\/(api\.|beta\.|)observablehq\.com\//i.exec(name))
  ) {
    // https://api.observablehq.com/@fil/lasso-selection.js?v=3
    // https://api.observablehq.com/@fil/lasso-selection.js
    // https://api.observablehq.com/d/d63d95f7cba53f15.js?v=3
    name = name.slice(m[0].length);
    name = name.replace(/\.js$/g, ""); // Remove "js" extension
  }

  // "@jashkenas/inputs"
  // d/609547f6d5a0d1ca
  if (
    (m = /^(@\S+\/\S+)$/i.exec(name)) || (m = /^(d\/[0-9a-z]+)$/i.exec(name))
  ) {
    name = m[0];
  } else {
    name = null;
  }
  return name ? `https://api.observablehq.com/${name}.js?v=3` : source;
}
