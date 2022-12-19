import { walk } from "@observablehq/parser";
import { simple } from "acorn-walk";

export default function getCellCodeAndReferences(cell) {
  let bodyText = cell.input.substring(cell.body.start, cell.body.end);

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
