import { walk, parseCell } from "@observablehq/parser";
import { simple } from "acorn-walk";

export function parse(cellsCode, options = {}) {
  const cells = [];
  if (typeof cellsCode === 'string') cellsCode = [cellsCode];
  for (let code of cellsCode) {
    const cell = parseCell(code, options);
    if (cell.body.type === "ImportDeclaration") {
      cells.push(...getImports(cell, code));
    } else {
      cells.push(...getCellDefinitions(cell, code));
    }
  }
  return cells;
}

function getImports(cell) {
  const addTo = (list, d) => {
    if (d.view) {
      list.push({
        name: "viewof " + d.imported.name,
        alias: "viewof " + d.local.name,
      });
    } else if (d.mutable) {
      list.push({
        name: "mutable " + d.imported.name,
        alias: "mutable " + d.local.name,
      });
    }
    list.push({
      name: d.imported.name,
      alias: d.local.name,
    });
    return list;
  };
  const specifiers = (cell.body.specifiers || []).reduce(addTo, []);
  const injections = (cell.body.injections || []).reduce(addTo, []);
  const source = cell.body.source.value;
  return [{
    type: "import",
    source,
    specifiers,
    injections,
  }];
}

function getCellDefinitions(cell, source) {
  const { references, code, constants } = getCellCodeAndReferences(cell, source);

  let name = null;
  if (cell.id && cell.id.name) name = cell.id.name;
  else if (cell.id && cell.id.id && cell.id.id.name) name = cell.id.id.name;
  // if (!name) name = `$cell_${getCellDefinitions.id = (getCellDefinitions.id || 0) + 1}`;

  const cells = [];
  const addCell = (fields) => {
    fields = Object.entries(fields).reduce((obj, [field, value]) => {
      if (value !== undefined) obj[field] = value;
      return obj;
    }, {
      type: "cell",
    });
    cells.push(fields);
  }
  if (cell.id && cell.id.type === "ViewExpression") {
    addCell({
      name: `viewof ${name}`,
      references,
      code,
      constants,
    });
    addCell({
      name,
      references: ["Generators", `viewof ${name}`],
      code:
        `function value_${name}(Generators, $) { return Generators.input($); }`,
    });
  } else if (cell.id && cell.id.type === "MutableExpression") {
    addCell({
      name: `mutable initial ${name}`,
      references,
      code,
      constants,
    });
    addCell({
      name: `mutable ${name}`,
      references: ["Mutable", `mutable initial ${name}`],
      code: `function mutable_${name}(Mutable, $) { return new Mutable($); }`,
    });
    addCell({
      name,
      references: [`mutable ${name}`],
      code: `function value_${name}($) { return $.generator; }`,
    });
  } else {
    addCell({
      name,
      references,
      code,
      constants,
    });
  }
  return cells;
}

function getCellCodeAndReferences(cell, source) {
  let bodyText = source.substring(cell.body.start, cell.body.end);

  const _getRefName = (ref) => {
    if (!ref) return null;
    if (ref.type === "ViewExpression") {
      return "viewof " + ref.id.name;
    } else if (ref.type === "MutableExpression") {
      return "mutable " + ref.id.name;
    } else return ref.name;
  };

  let $count = 0;
  const refIndex = {};
  const references = [];
  const codeReferences = [];
  let constants;
  (cell.references || []).forEach((ref) => {
    let refName = _getRefName(ref);
    const $string = refIndex[refName] || ref.name || "$" + ($count++);
    refName = refName || $string;
    const replacement = (ref.type === "ViewExpression")
      ? $string
      : (ref.type === "MutableExpression")
      ? $string + ".value"
      : null;
    const walkConfig = {
      "CallExpression": (node) => {
        const calleeName = node.callee ? node.callee.name : null;
        if (
          calleeName === "FileAttachment" ||
          calleeName === "Secret" ||
          calleeName === "DatabaseClient"
        ) {
          constants = constants || {};
          const index = constants[calleeName] = constants[calleeName] || {};
          const arg = ((node.arguments || [])[0] || {}).value;
          index[arg] = arg;
        }
      },
    };
    if (replacement) {
      let indexShift = 0;
      walkConfig[ref.type] = (node) => {
        const start = node.start - cell.body.start;
        const end = node.end - cell.body.start;
        bodyText = bodyText.slice(0, start + indexShift) + replacement +
          bodyText.slice(end + indexShift);
        indexShift += replacement.length - (end - start);
      };
    }
    simple(cell.body, walkConfig, walk);

    if (!(refName in refIndex)) {
      refIndex[refName] = $string;
      references.push(refName);
      codeReferences.push($string);
    }
  });

  let code = (cell.body.type !== "BlockStatement")
    ? `{\nreturn (${bodyText});\n}`
    : bodyText;

  const refs = codeReferences.join(",");
  const name = _getRefName(cell.id);
  const functionName = name
    ? name.replace(/^mutable /, "mutable_initial_")
      .replace(/\s/gim, "_")
    : ``;
  if (cell.generator && cell.async) {
    code = `async function* ${functionName}(${refs}) ${code}`;
  } else if (cell.async) {
    code = `async function ${functionName}(${refs}) ${code}`;
  } else if (cell.generator) {
    code = `function* ${functionName}(${refs}) ${code}`;
  } else code = `function ${functionName}(${refs}) ${code}`;

  const result = { references, code };
  if (constants) {
    // for (const [key, values] of Object.entries(constants)) {
    //   if (key !== 'FileAttachment') {
    //     constants[key] = Object.keys(values).sort();
    //   }
    // }
    result.constants = constants;
  }
  return result;
}
