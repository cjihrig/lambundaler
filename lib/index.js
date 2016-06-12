'use strict';

const Path = require('path');
const Browserify = require('browserify');
const Fse = require('fs-extra');
const Insync = require('insync');
const Joi = require('joi');
const Merge = require('lodash.merge');
const Zipit = require('zipit');

const defaults = {
  bundler: {
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
  }
};

const schema = Joi.object({
  entry: Joi.string().required().description('input file containing the handler'),
  export: Joi.string().required().description('named export implementing the handler'),
  bundler: Joi.object().description('settings passed to browserify'),
  minify: Joi.boolean().optional().default(false).description('minify the bundle'),
  sourcemap: Joi.string().optional().default(false).description('name of source map'),
  sourcemapOutput: Joi.string().optional().description('path to write source map'),
  files: Joi.array().items(
    Joi.string().description('file or directory to include in zip'),
    Joi.object().keys({
      name: Joi.string().required().description('file name in zip file'),
      data: Joi.any().required().description('file data in zip file')
    }).description('name and data representing a zipped file')
  ).optional().default([]).description('additional files to include in zip file'),
  output: Joi.string().optional().description('path to write zip file')
}).with('sourcemap', 'minify').with('sourcemapOutput', 'sourcemap');


function createBundle (settings, next) {
  settings.bundler.entries = [settings.entry];
  settings.bundler.debug = settings.minify;

  const browserify = Browserify(settings.bundler);

  if (settings.minify) {
    browserify.plugin('minifyify', {
      map: settings.sourcemap,
      output: settings.sourcemapOutput
    });
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


module.exports = function bundle (options, callback) {
  function setup (next) {
    const settings = Merge({}, defaults, options);

    Joi.validate(settings, schema, next);
  }

  Insync.waterfall([
    setup,
    createBundle,
    zip,
    writeOutput
  ], function waterfallCb (err, settings, buffer, artifacts) {
    callback(err, buffer, artifacts);
  });
};
