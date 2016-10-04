'use strict';

const Os = require('os');
const Path = require('path');
const Aws = require('aws-sdk');
const Browserify = require('browserify');
const Fse = require('fs-extra');
const Insync = require('insync');
const Joi = require('joi');
const Lambstaller = require('lambstaller');
const Merge = require('lodash.merge');
const Uuid = require('node-uuid');
const Zipit = require('zipit');

const bundlerDefaults = {
  standalone: 'lambda',
  browserField: false,
  builtins: false,
  commondir: false,
  ignoreMissing: true,
  detectGlobals: true,
  debug: false,
  insertGlobalVars: {
    process: function () {}
  }
};

const lambdaDefaults = {
  runtime: 'nodejs4.3',
  timeout: 3,
  memory: 128
};

const mergeDefaults = { bundler: bundlerDefaults };

const schema = Joi.object({
  entry: Joi.string().required().description('input file containing the handler'),
  export: Joi.string().required().description('named export implementing the handler'),
  env: Joi.object().optional().description('environment variables to include in lambda function'),
  bundler: Joi.object().description('settings passed to browserify'),
  minify: Joi.boolean().optional().default(false).description('minify the bundle'),
  sourcemap: Joi.string().optional().default(false).description('name of source map'),
  sourcemapOutput: Joi.string().optional().description('path to write source map'),
  exclude: Joi.array().items(Joi.string()).optional().default([]).description('modules to exclude during bundling'),
  install: Joi.object().keys({
    pkg: Joi.string().required().description('package.json file to npm install'),
    out: Joi.string().optional().default(() => {
      return Path.join(Os.tmpdir(), Uuid.v4());
    }, 'directory to install to').description('directory to install to')
  }).optional().description('settings for installing modules in a Lambda container'),
  files: Joi.array().items(
    Joi.string().description('file or directory to include in zip'),
    Joi.object().keys({
      name: Joi.string().required().description('file name in zip file'),
      data: Joi.any().required().description('file data in zip file')
    }).description('name and data representing a zipped file')
  ).optional().default([]).description('additional files to include in zip file'),
  output: Joi.string().optional().description('path to write zip file'),
  deploy: Joi.object().keys({
    config: Joi.object().optional().default({}).description('general AWS config'),
    overwrite: Joi.boolean().optional().default(false).description('delete existing function before deployment'),
    name: Joi.string().required().description('AWS function name'),
    role: Joi.string().required().description('AWS role with execute permissions'),
    runtime: Joi.string().valid('nodejs', 'nodejs4.3').optional().default(lambdaDefaults.runtime).description('AWS runtime'),
    timeout: Joi.number().positive().integer().optional().default(lambdaDefaults.timeout).description('function execution timeout in seconds'),
    memory: Joi.number().positive().integer().multiple(64).optional().default(lambdaDefaults.memory).description('allocated function memory in MB')
  }).optional().description('settings for deploying to AWS')
}).with('sourcemap', 'minify').with('sourcemapOutput', 'sourcemap');


function maybeInstall (settings, next) {
  const options = settings.install;

  if (!options) {
    return next(null, settings);
  }

  Lambstaller(options, function lambstallCb (err) {
    settings.files.concat(Path.join(options.out, 'node_modules'));
    next(err, settings);
  });
}


function createBundle (settings, next) {
  settings.bundler.entries = [settings.entry];
  settings.bundler.debug = settings.minify;

  const browserify = Browserify(settings.bundler);

  settings.exclude.forEach(function excludeEach (exclude) {
    browserify.exclude(exclude);
  });

  if (settings.minify) {
    browserify.plugin('minifyify', {
      map: settings.sourcemap,
      output: settings.sourcemapOutput
    });
  }

  if (settings.env !== undefined) {
    settings.bundler.insertGlobalVars.process = function () {
      return `(Object.assign(process.env, ${JSON.stringify(settings.env)}) && process)`;
    };
  }

  browserify.bundle(function browserifyCb (err, buffer, map) {
    const artifacts = {};

    if (map) {
      artifacts.sourcemap = map;
    }

    next(err, settings, buffer, artifacts);
  });
}


function zip (settings, buffer, artifacts, next) {
  const input = settings.files.concat({
    name: Path.basename(settings.entry),
    data: buffer
  });

  Zipit({ input }, function zipCb (err, zipData) {
    next(err, settings, zipData, artifacts);
  });
}


function writeOutput (settings, buffer, artifacts, next) {
  const output = settings.output;

  if (!output) {
    return next(null, settings, buffer, artifacts);
  }

  Fse.outputFile(output, buffer, function outputCb (err) {
    next(err, settings, buffer, artifacts);
  });
}


function deploy (settings, buffer, artifacts, next) {
  const options = settings.deploy;

  if (!options) {
    return next(null, settings, buffer, artifacts);
  }

  const lambda = new Aws.Lambda(options.config);

  Insync.series({
    maybeDelete (cb) {
      if (options.overwrite !== true) {
        return cb();
      }

      lambda.deleteFunction({
        FunctionName: options.name
      }, function deleteCb (ignoreErr) {
        cb();
      });
    },
    create (cb) {
      lambda.createFunction({
        Code: { ZipFile: buffer },
        FunctionName: options.name,
        Handler: `${Path.basename(settings.entry, '.js')}.${settings.export}`,
        Role: options.role,
        Runtime: options.runtime,
        Timeout: options.timeout,
        MemorySize: options.memory
      }, function createCb (err, fn) {
        artifacts.lambda = fn;
        cb(err);
      });
    }
  }, function seriesCb (err, results) {
    next(err, settings, buffer, artifacts);
  });
}


function bundle (options, callback) {
  function setup (next) {
    const settings = Merge({}, mergeDefaults, options);

    Joi.validate(settings, schema, next);
  }

  Insync.waterfall([
    setup,
    maybeInstall,
    createBundle,
    zip,
    writeOutput,
    deploy
  ], function waterfallCb (err, settings, buffer, artifacts) {
    callback(err, buffer, artifacts);
  });
}

bundle.bundle = bundle; // Make bundle() more accessible for testing
bundle.defaults = Merge({}, { lambda: lambdaDefaults });
module.exports = bundle;
