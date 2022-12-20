export function newCompiler({ resolve, runtime, module, observer }) {
  module = module || runtime.module();
  return async (cells, call = ({ method, args }) => method.apply(null, args)) => {
    const imports = [];
    for await (let cell of cells) {
      if (cell.type === "import") {
        const { source, specifiers, injections } = cell;
        imports.push(async (resolve) => {
          let importedModule = await resolve({
            source,
            runtime,
            observer,
          });
          if (injections.length) {
            importedModule = importedModule.derive(injections, module);
          }
          specifiers.map((specifier) => {
            module.import(specifier.name, specifier.alias, importedModule);
          });
        });
      } else {
        const { name, references = [], code /*, constants */ } = cell;
        let m = typeof code === "string"
          ? new Function([], `"use strict"\nreturn (${code})`)()
          : code;
        const variable = module.variable(observer(name));
        variable.define(name, references, (...args) => call({
          method : m,
          args,
          cell,
          module,
          runtime
        }));
      }
    }
    for (const imp of imports) {
      await imp(resolve);
    }
    return module;
  };
}
