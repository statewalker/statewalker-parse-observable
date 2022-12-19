import { default as expect } from 'expect.js';
// import { newHtmlParser } from '@dynotes/parser-html';
import parseObservableCell from "../src/parse/parseObservableCell.js";
import CodeTreeBuilder from '../src/tree/CodeTreeBuilder.js';

import tests from './parseObservableCellTest.data.js'

describe('parseObservableCell', () => {
  for (const test of tests) {
    it(test.message, () => {
      const listener = new CodeTreeBuilder();
      parseObservableCell(test.source, listener);
      const module = listener.result;
      try {
        expect(typeof module).to.be('object');
        expect(Array.isArray(module.cells)).to.be(true);
        expect(module.cells).to.eql(test.control);
      } catch (err) {
        console.log(JSON.stringify(module, null, 2));
        throw err;
      }
    })
  }
})
