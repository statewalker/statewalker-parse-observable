export default function visitCellImports(cell, listener) {
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
  listener.onImport({ source, specifiers, injections });
}
