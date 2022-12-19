import getCellCodeAndReferences from "./getCellCodeAndReferences.js";

export default function visitCellDefinitions(cell, listener) {
  const { references, code, constants } = getCellCodeAndReferences(cell);

  let name = null;
  if (cell.id && cell.id.name) name = cell.id.name;
  else if (cell.id && cell.id.id && cell.id.id.name) name = cell.id.id.name;
  // if (!name) name = `$cell_${getCellDefinitions.id = (getCellDefinitions.id || 0) + 1}`;

  if (cell.id && cell.id.type === "ViewExpression") {
    listener.onCell({
      name: `viewof ${name}`,
      references,
      code,
      constants,
    });
    listener.onCell({
      name,
      references: ["Generators", `viewof ${name}`],
      code:
        `function value_${name}(Generators, $) { return Generators.input($); }`,
    });
  } else if (cell.id && cell.id.type === "MutableExpression") {
    listener.onCell({
      name: `mutable initial ${name}`,
      references,
      code,
      constants,
    });
    listener.onCell({
      name: `mutable ${name}`,
      references: ["Mutable", `mutable initial ${name}`],
      code: `function mutable_${name}(Mutable, $) { return new Mutable($); }`,
    });
    listener.onCell({
      name,
      references: [`mutable ${name}`],
      code: `function value_${name}($) { return $.generator; }`,
    });
  } else {
    listener.onCell({
      name,
      references,
      code,
      constants,
    });
  }
}
