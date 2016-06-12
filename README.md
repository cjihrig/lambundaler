# lambundaler

[![Current Version](https://img.shields.io/npm/v/lambundaler.svg)](https://www.npmjs.org/package/lambundaler)
[![Build Status via Travis CI](https://travis-ci.org/continuationlabs/lambundaler.svg?branch=master)](https://travis-ci.org/continuationlabs/lambundaler)
![Dependencies](http://img.shields.io/david/continuationlabs/lambundaler.svg)

[![belly-button-style](https://cdn.rawgit.com/continuationlabs/belly-button/master/badge.svg)](https://github.com/continuationlabs/belly-button)

`lambundaler` is a bundler for AWS Lambda functions. The module exports a single function that Browserifies and zips code, making it suitable for deployment as a Lambda function. The zipped code can be optionally written to an output file.

## Example

The following example creates a zipped bundle from the code specified in `entry`. The zipped bundle is written to the path specified by `output`.

```javascript
'use strict';

const Lambundaler = require('lambundaler');

Lambundaler({
  entry: 'path-to-your-main-file.js',
  export: 'lambda-entry-point-export',
  output: 'path-to-write-zip-file.zip'
}, (err, buffer) => {
  if (err) {
    console.error(err);
    return;
  }

  // Handle buffer, which is an instance of Buffer
});
```

## API

The function exported by `lambundaler` behaves as follows:

  - Arguments
    - `options` (object) - A configuration object supporting the following schema.
      - `entry` (string) - File path containing the Lambda function code.
      - `export` (string) - The export in `entry` implementing the Lambda function.
      - `bundler` (object) - Optional configuration object passed directly to Browserify.
      - `files` (array) - An optional array of strings and/or objects indicating additional files (such as standalone executables) to include in the zip archive. Strings specify file and directory paths. Objects should have `name` and `data` properties which are used as the file name and contents in the zip archive.
      - `output` (string) - Optional path to write the zip archive to.
    - `callback` (function) - A function which is called upon completion. This function takes the following arguments.
      - `err` (error) - Represents any error that occurs.
      - `buffer` (`Buffer`) - Contains the zip archive, represented as a Node.js `Buffer`.
  - Returns
    - Nothing
