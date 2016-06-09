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
    insertGlobalVars: {
      process: function () {}
    }
  }
};

const schema = Joi.object({
  entry: Joi.string().required().description('input file containing the handler'),
  export: Joi.string().required().description('named export implementing the handler'),
  bundler: Joi.object().description('settings passed to browserify'),
  files: Joi.array().items(
    Joi.string().description('file or directory to include in zip'),
    Joi.object().keys({
      name: Joi.string().required().description('file name in zip file'),
      data: Joi.any().required().description('file data in zip file')
    }).description('name and data representing a zipped file')
  ).optional().default([]).description('additional files to include in zip file'),
  output: Joi.string().optional().description('path to write zip file')
});


function createBundle (settings, next) {
  settings.bundler.entries = [settings.entry];

  const browserify = Browserify(settings.bundler);

  browserify.bundle(function browserifyCb (err, buffer) {
    next(err, settings, buffer);
  });
}


function zip (settings, buffer, next) {
  const input = settings.files.concat({
    name: Path.basename(settings.entry),
    data: buffer
  });

  Zipit({ input }, function zipCb (err, zipData) {
    next(err, settings, zipData);
  });
}


function writeOutput (settings, buffer, next) {
  const output = settings.output;

  if (!output) {
    return next(null, settings, buffer);
  }

  Fse.outputFile(output, buffer, function outputCb (err) {
    next(err, settings, buffer);
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
  ], function waterfallCb (err, settings, buffer) {
    callback(err, buffer);
  });
};
