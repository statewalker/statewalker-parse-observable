export default class CodeTreeBuilder {
  constructor(module) {
    this.module = module || {
      meta: {},
      cells: [],
    };
  }

  get result() {
    return this.module;
  }

  onCell({ name, references = [], code, constants } = {}) {
    const cell = {
      type: "cell",
      name,
      references,
      code,
    };
    if (constants) cell.constants = constants;
    this.module.cells.push(cell);
  }

  onImport({ source, specifiers, injections } = {}) {
    const cell = {
      type: "import",
      source,
      specifiers,
      injections,
    };
    this.module.cells.push(cell);
  }
}
