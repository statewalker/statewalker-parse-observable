export default class CompilingListener {
  constructor(options) {
    this.options = options;
    this._runImports = [];
  }

  get module() {
    if (!this._module) {
      this._module = this.options.module;
      if (!this._module) {
        this._module = this.runtime.module();
      }
    }
    return this._module;
  }

  get runtime() {
    return this.options.runtime;
  }

  get observer() {
    return this.options.observer;
  }

  async finalize(resolve) {
    for (const imp of this._runImports) {
      await imp(resolve);
    }
    return this.module;
  }

  onCell({ name, references = [], code /*, constants */ } = {}) {
    const m = typeof code === "string"
      ? new Function([], `return (${code})`)()
      : code;
    this.module.variable(this.observer(name)).define(name, references, m);
  }

  onImport({ source, specifiers, injections } = {}) {
    this._runImports.push(async (resolve) => {
      let importedModule = await resolve({
        source,
        runtime: this.runtime,
        observer: this.observer,
      });
      if (injections.length) {
        importedModule = importedModule.derive(injections, this.module);
      }
      specifiers.map((specifier) => {
        this.module.import(specifier.name, specifier.alias, importedModule);
      });
    });
  }
}
