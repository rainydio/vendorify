# NOT TESTED (almost)

# Vendorify

[Browserify](https://npmjs.org/package/browserify) plugin to bundle
node_modules dependencies into separate file.

# Example

Running vendorify with standard browserify `--outfile mybundle.js` option
will produce two files `mybundle.js` and `mybundle.vendor.js`.

```sh
vendorify --outfile mybundle.js src/index.js
```

You can specify custom file name through `--vendor-outfile` option

```sh
vendorify --outfile mybundle.js --vendor-outfile common.js src/index.js
```

By default source maps are not generated, even with `--debug` option.
But it's possible to force them using `--debug-vendor` option.

It's compatible with [watchify](https://npmjs.org/package/watchify)

```sh
watchify --outfile mybundle.js -p [vendorify -o common.js] src/index.js
```
