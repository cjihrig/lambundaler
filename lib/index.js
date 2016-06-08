'use strict';

const Browserify = require('browserify');
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
  bundler: Joi.object().description('settings passed to browserify')
});


function createBundle (settings, next) {
  settings.bundler.entries = [settings.entry];

  const browserify = Browserify(settings.bundler);

  browserify.bundle(function browserifyCb (err, buffer) {
    next(err, settings, buffer);
  });
}


function zip (settings, buffer, next) {
  Zipit({
    input: [{ name: 'index.js', data: buffer }]
  }, function zipCb (err, zipData) {
    next(err, settings, zipData);
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
    zip
  ], function waterfallCb (err, settings, buffer) {
    callback(err, buffer);
  });
};
