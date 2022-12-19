export default function visitModule(module, listener) {
  for (const cell of module.cells) {
    if (cell.type === "cell") {
      listener.onCell(cell);
    } else if (cell.type === "import") {
      listener.onImport(cell);
    }
  }
}
