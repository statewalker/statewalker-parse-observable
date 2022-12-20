export function newCompiler({ resolve, runtime, module, observer }) {
  module = module || runtime.module();
  return async (cells, context) => {
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
        if (context) m = m.bind(context);
        module.variable(observer(name)).define(name, references, m);
      }
    }
    for (const imp of imports) {
      await imp(resolve);
    }
    return module;
  };
}
