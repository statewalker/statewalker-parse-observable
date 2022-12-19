import { parseCell } from "@observablehq/parser";
import visitCellImports from "./visitCellImports.js";
import visitCellDefinitions from "./visitCellDefinitions.js";

export default function parseObservableCell(code, listener, options = {}) {
  const cell = parseCell(code, options);
  cell.input = code;
  if (cell.body.type === "ImportDeclaration") {
    visitCellImports(cell, listener);
  } else {
    visitCellDefinitions(cell, listener);
  }
}
