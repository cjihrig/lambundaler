'use strict';

const Os = require('os');
const Path = require('path');
const Code = require('code');
const Fse = require('fs-extra');
const Insync = require('insync');
const Lab = require('lab');
const StandIn = require('stand-in');
const Zip = require('jszip');
const L = require('../lib');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;

const fixturesDirectory = Path.join(__dirname, 'fixtures');


function unzip (buffer, callback) {
  Zip.loadAsync(buffer).then((zip) => {
    zip.generateAsync({
      type: 'nodebuffer',
      compression: 'STORE',
      platform: process.platform
    })
    .then((data) => {
      Insync.each(Object.keys(zip.files), (key, next) => {
        const file = zip.files[key];

        if (file.dir) {
          return next();
        }

        file.async('nodebuffer')
          .then((content) => {
            file._asBuffer = content;
            next();
          })
          .catch((err) => { next(err); });
      }, (err) => {
        callback(err, zip, data);
      });
    })
    .catch((err) => { callback(err); });
  });
}


describe('Lambundaler', () => {
  it('creates a zipped bundle', (done) => {
    L({
      entry: Path.join(fixturesDirectory, 'single-file.js'),
      export: 'handler'
    }, (err, buffer) => {
      expect(err).to.not.exist();
      expect(buffer).to.be.an.instanceOf(Buffer);
      unzip(buffer, (err, zip, buffer) => {
        expect(err).to.not.exist();

        const file = zip.files['single-file.js'];

        expect(Object.keys(zip.files).length).to.equal(1);
        expect(file._asBuffer.toString()).to.match(/\/\/ Single file handler/);
        done();
      });
    });
  });

  it('creates a zipped bundle with additional files', (done) => {
    const file1 = Path.join(fixturesDirectory, 'file1.txt');
    const file2 = Path.join(fixturesDirectory, 'file2.txt');

    L({
      entry: Path.join(fixturesDirectory, 'single-file.js'),
      export: 'handler',
      files: [file1, file2]
    }, (err, buffer) => {
      expect(err).to.not.exist();
      expect(buffer).to.be.an.instanceOf(Buffer);
      unzip(buffer, (err, zip, buffer) => {
        expect(err).to.not.exist();
        expect(Object.keys(zip.files).length).to.equal(3);
        expect(zip.files['single-file.js']._asBuffer.toString()).to.match(/\/\/ Single file handler/);
        expect(zip.files['file1.txt']._asBuffer).to.equal(Fse.readFileSync(file1));
        expect(zip.files['file2.txt']._asBuffer).to.equal(Fse.readFileSync(file2));
        done();
      });
    });
  });

  it('supports writing an output file', (done) => {
    const outputPath = Path.join(Os.tmpdir(), 'out.zip');
    let outputBuffer;

    StandIn.replace(Fse, 'outputFile', (stand, path, data, callback) => {
      expect(path).to.equal(outputPath);
      outputBuffer = data;
      callback();
    });

    L({
      entry: Path.join(fixturesDirectory, 'single-file.js'),
      export: 'handler',
      output: outputPath
    }, (err, buffer) => {
      expect(err).to.not.exist();
      expect(buffer).to.be.an.instanceOf(Buffer);
      expect(buffer).to.equal(outputBuffer);
      done();
    });
  });
});
