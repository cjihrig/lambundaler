'use strict';

// eslint-disable-next-line no-unused-vars
const Aws = require('aws-sdk');

exports.handler = function handler (event, context, callback) {
  callback(null, { foo: 'bar' });
};
