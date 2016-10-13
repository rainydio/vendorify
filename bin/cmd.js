#!/usr/bin/env node
/* eslint-disable no-console */

"use strict";

var fs = require("fs");
var fromArgs = require("browserify/bin/args");
var vendorify = require("../");

function onError(err) {
	console.error(err.stack || String(err));
	process.exit(1);
}

var b = fromArgs(process.argv.slice(2));

if (typeof b.argv.vendor !== "string" && !b.argv.outfile) {
	console.error("You have to set either `--outfile bundle.js` or `--vendor bundle.vendor.js` option");
	process.exit(1);
}

var opts = { debug: false };

if (b.argv["vendor-debug"]) {
	opts.debug = true;
}
if (b.argv.vendor) {
	opts.outfile = b.argv.vendor;
}

var bundle = vendorify(b, opts).bundle();
bundle.on("error", onError);

var outfile = b.argv.o || b.argv.outfile;
if (outfile) {
	bundle.pipe(fs.createWriteStream(outfile));
}
else {
	bundle.pipe(process.stdout);
}
