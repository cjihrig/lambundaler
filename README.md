# lambundaler

[![Current Version](https://img.shields.io/npm/v/lambundaler.svg)](https://www.npmjs.org/package/lambundaler)
[![Build Status via Travis CI](https://travis-ci.org/cjihrig/lambundaler.svg?branch=master)](https://travis-ci.org/cjihrig/lambundaler)
![Dependencies](http://img.shields.io/david/cjihrig/lambundaler.svg)
[![belly-button-style](https://img.shields.io/badge/eslint-bellybutton-4B32C3.svg)](https://github.com/cjihrig/belly-button)


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
}, (err, buffer, artifacts) => {
  if (err) {
    console.error(err);
    return;
  }

  // Handle buffer, which is an instance of Buffer and
  // artifacts, which is an object
});
```

## API

The function exported by `lambundaler` behaves as follows:

  - Arguments
    - `options` (object) - A configuration object supporting the following schema.
      - `entry` (string) - File path containing the Lambda function code.
      - `export` (string) - The export in `entry` implementing the Lambda function.
      - `env` (object) - Optional object whose keys are merged into `process.env` in the resulting Lambda function.
      - `bundler` (object) - Optional configuration object passed directly to Browserify.
      - `minify` (boolean) - If `true`, the bundle will be minified. Defaults to `false`.
      - `sourcemap` (string or boolean) - If minification is enabled, setting this to `false` prevents a source map from being generated. Setting this to a string allows you to name the source map. Defaults to `false`.
      - `sourcemapOutput` (string) - An optional path to write the source map to.
      - `exclude` (array) - An optional array of strings representing modules to exclude from the bundle. This array is passed to Browserify. This option is essential when bundling code that uses the `'aws-sdk'` module. You can bundle `'aws-sdk'` via the `files` option, or rely on the version that is natively available on Lambda.
      - `install` (object) - Optional object used to run [`lambstaller`](https://github.com/cjihrig/lambstaller). If this object is not included, the install will not be run. This object supports the following schema.
        - `pkg` (string) - The path to a `package.json` file. This file will be the target of `npm install --production`.
        - `out` (string) - The directory where the `package.json` file will be copied and the install will occur. The resulting `node_modules` directory will be automatically added to the bundle. This value is optional. If it is not included, a directory will be created in the system's temp directory.
        - `version` (string) - The Node.js version to use. This is important for native addon compatibility. Valid values are `'nodejs'`, `'nodejs4.3'`, and `'nodejs6.10'`. Defaults to `'nodejs6.10'`.
      - `files` (array) - An optional array of strings and/or objects indicating additional files (such as standalone executables) to include in the zip archive. Strings specify file and directory paths. Objects should have `name` and `data` properties which are used as the file name and contents in the zip archive.
      - `output` (string) - Optional path to write the zip archive to.
      - `deploy` (object) - Optional object used to deploy to AWS. The following properties are supported.
        - `config` (object) - An optional configuration passed directly to [`Aws.Lambda()`](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html#constructor-property) constructor.
        - `name` (string) - The name to give the Lambda function.
        - `overwrite` (boolean) - If `true`, `lambundaler` will attempt to delete the function specified by the `name` option. Defaults to `false`.
        - `role` (string) - An AWS role with permission to execute the Lambda.
        - `runtime` (string) - The Lambda runtime to use. Valid values are `'nodejs'`, `'nodejs4.3'`, and `'nodejs6.10'`. Defaults to `'nodejs6.10'`.
        - `timeout` (number) - The execution timeout of the Lambda function in seconds. Defaults to three seconds.
        - `memory` (number) - The amount of memory, in MB, given to the Lambda function. Must be a multiple of 64MB. Defaults to 128MB.
    - `callback` (function) - A function which is called upon completion. This function takes the following arguments.
      - `err` (error) - Represents any error that occurs.
      - `buffer` (`Buffer`) - Contains the zip archive, represented as a Node.js `Buffer`.
      - `artifacts` (object) - An object containing items generated during the build process. This object can contain the following properties.
        - `sourcemap` (string) - A source map generated during minification.
        - `lambda` (object) - The Lambda function object created during deployment.
  - Returns
    - Nothing
