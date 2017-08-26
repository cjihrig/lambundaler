'use strict';

const Cp = require('child_process');
const Os = require('os');
const Path = require('path');
const AwsMock = require('aws-sdk-mock');
const Fse = require('fs-extra');
const Insync = require('insync');
const Lab = require('lab');
const StandIn = require('stand-in');
const WillCall = require('will-call');
const Zip = require('jszip');
const L = require('../lib');

const lab = exports.lab = Lab.script();
const expect = Lab.expect;
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
    }, (err, buffer, artifacts) => {
      expect(err).to.not.exist();
      expect(buffer).to.be.an.instanceOf(Buffer);
      expect(artifacts).to.equal({});
      unzip(buffer, (err, zip, buffer) => {
        expect(err).to.not.exist();

        const file = zip.files['single-file.js'];

        expect(Object.keys(zip.files).length).to.equal(1);
        expect(file._asBuffer.toString()).to.match(/\/\/ Single file handler/);
        done();
      });
    });
  });

  it('passes environment variables', (done) => {
    const env = { foo: 'abc', bar: 999, baz: null };

    L({
      entry: Path.join(fixturesDirectory, 'env-vars.js'),
      export: 'handler',
      env
    }, (err, buffer, artifacts) => {
      expect(err).to.not.exist();
      expect(buffer).to.be.an.instanceOf(Buffer);
      expect(artifacts).to.equal({});
      unzip(buffer, (err, zip, buffer) => {
        expect(err).to.not.exist();

        const file = zip.files['env-vars.js'];

        expect(Object.keys(zip.files).length).to.equal(1);
        expect(file._asBuffer.toString()).to.include(JSON.stringify(env));
        done();
      });
    });
  });

  it('minifies the bundle', (done) => {
    L({
      entry: Path.join(fixturesDirectory, 'single-file.js'),
      export: 'handler',
      minify: true
    }, (err, buffer, artifacts) => {
      expect(err).to.not.exist();
      expect(buffer).to.be.an.instanceOf(Buffer);
      expect(artifacts).to.equal({});
      unzip(buffer, (err, zip, buffer) => {
        expect(err).to.not.exist();

        const file = zip.files['single-file.js'];

        expect(Object.keys(zip.files).length).to.equal(1);
        expect(file._asBuffer.toString()).to.not.match(/\/\/ Single file handler/);
        done();
      });
    });
  });

  it('generates a source map for a minified bundle', (done) => {
    L({
      entry: Path.join(fixturesDirectory, 'single-file.js'),
      export: 'handler',
      minify: true,
      sourcemap: 'foo.js.map'
    }, (err, buffer, artifacts) => {
      expect(err).to.not.exist();
      expect(buffer).to.be.an.instanceOf(Buffer);
      expect(artifacts).to.be.an.object();
      expect(artifacts.sourcemap).to.be.a.string();
      expect(artifacts.sourcemap).to.match(/\/\/ Single file handler/);
      unzip(buffer, (err, zip, buffer) => {
        expect(err).to.not.exist();

        const file = zip.files['single-file.js'];

        expect(Object.keys(zip.files).length).to.equal(1);
        expect(file._asBuffer.toString()).to.not.match(/\/\/ Single file handler/);
        done();
      });
    });
  });

  it('excludes modules from the bundle', (done) => {
    L({
      entry: Path.join(fixturesDirectory, 'excludes.js'),
      export: 'handler',
      exclude: ['aws-sdk']
    }, (err, buffer, artifacts) => {
      expect(err).to.not.exist();
      expect(buffer).to.be.an.instanceOf(Buffer);
      expect(artifacts).to.equal({});
      unzip(buffer, (err, zip, buffer) => {
        expect(err).to.not.exist();
        expect(Object.keys(zip.files).length).to.equal(1);
        expect(zip.files['excludes.js']._asBuffer.toString().indexOf('Amazon')).to.equal(-1);
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
    }, (err, buffer, artifacts) => {
      expect(err).to.not.exist();
      expect(buffer).to.be.an.instanceOf(Buffer);
      expect(artifacts).to.equal({});
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

  it('runs npm install in a container', (done) => {
    const wc = new WillCall();
    StandIn.replace(Cp, 'exec', wc.expect((stand, cmd, callback) => {
      expect(cmd).to.match(/^docker run -v/);
      callback();
    }), { stopAfter: 1 });

    L({
      entry: Path.join(fixturesDirectory, 'single-file.js'),
      export: 'handler',
      install: {
        pkg: Path.resolve(__dirname, '..', 'package.json')
      }
    }, (err, buffer, artifacts) => {
      expect(err).to.exist();
      expect(err.code).to.equal('ENOENT');
      expect(err.path).to.match(/\/node_modules$/);
      expect(wc.check()).to.equal([]);
      done();
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
    }, (err, buffer, artifacts) => {
      expect(err).to.not.exist();
      expect(buffer).to.be.an.instanceOf(Buffer);
      expect(buffer).to.equal(outputBuffer);
      expect(artifacts).to.equal({});
      done();
    });
  });

  it('deploys to AWS', (done) => {
    AwsMock.mock('Lambda', 'createFunction', function (options, callback) {
      callback(null, { options });
    });

    L({
      entry: Path.join(fixturesDirectory, 'single-file.js'),
      export: 'handler',
      deploy: {
        config: {
          accessKeyId: 'foo',
          secretAccessKey: 'bar',
          region: 'us-east-99'
        },
        name: 'foobar',
        role: 'arn:aws:iam::12345:role/lambda_basic_execution',
        memory: 256,
        timeout: 100
      }
    }, (err, buffer, artifacts) => {
      AwsMock.restore('Lambda', 'createFunction');
      expect(err).to.not.exist();
      expect(buffer).to.be.an.instanceOf(Buffer);
      expect(artifacts.lambda).to.be.an.object();
      expect(artifacts.lambda.options).to.be.an.object();
      expect(artifacts.lambda.options).to.include({
        FunctionName: 'foobar',
        Handler: 'single-file.handler',
        MemorySize: 256,
        Role: 'arn:aws:iam::12345:role/lambda_basic_execution',
        Runtime: 'nodejs4.3',
        Timeout: 100
      });
      done();
    });
  });

  it('attempts to delete an existing lambda with overwrite', (done) => {
    let called = false;

    AwsMock.mock('Lambda', 'deleteFunction', function (options, callback) {
      called = true;
      callback();
    });

    AwsMock.mock('Lambda', 'createFunction', function (options, callback) {
      callback(null, { foo: 'bar' });
    });

    L({
      entry: Path.join(fixturesDirectory, 'single-file.js'),
      export: 'handler',
      deploy: {
        config: {
          accessKeyId: 'foo',
          secretAccessKey: 'bar',
          region: 'us-east-99'
        },
        name: 'foobar',
        overwrite: true,
        role: 'arn:aws:iam::12345:role/lambda_basic_execution'
      }
    }, (err, buffer, artifacts) => {
      AwsMock.restore('Lambda', 'deleteFunction');
      AwsMock.restore('Lambda', 'createFunction');
      expect(err).to.not.exist();
      expect(called).to.equal(true);
      expect(buffer).to.be.an.instanceOf(Buffer);
      expect(artifacts).to.equal({ lambda: { foo: 'bar' } });
      done();
    });
  });
});
