'use strict';

exports.handler = function handler (event, context, callback) {
  // Single file handler
  callback(null, 'test handler!');
};
