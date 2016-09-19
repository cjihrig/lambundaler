'use strict';

exports.handler = function handler (event, context, callback) {
  callback(null, process.env);
};
