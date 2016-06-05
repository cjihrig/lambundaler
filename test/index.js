'use strict';

const Path = require('path');
const Code = require('code');
const Lab = require('lab');
const Zip = require('jszip');
const L = require('../lib');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;

const fixturesDirectory = Path.join(__dirname, 'fixtures');


describe('Lambundaler', () => {
  it('creates a bundle without zipping', (done) => {
    L({
      entry: Path.join(fixturesDirectory, 'single-file'),
      export: 'handler'
    }, (err, buffer) => {
      expect(err).to.not.exist();
      expect(buffer).to.be.an.instanceOf(Buffer);
      expect(buffer.toString()).to.not.match(/\/\/ Single file handler/);

      Zip.loadAsync(buffer).then((zip) => {
        zip.generateAsync({
          type: 'binarystring',
          compression: 'STORE',
          platform: process.platform
        }).then(function zipCb (data) {
          expect(data).to.match(/\/\/ Single file handler/);
          done();
        }).catch(function zipCatch (err) {
          Code.fail(err);
        });
      });
    });
  });
});
