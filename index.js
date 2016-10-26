"use strict";

var fs = require("fs");
var path = require("path");
var through = require("through2");
var bpack = require("browser-pack");
var vendorifyMdeps = require("./vendorify-mdeps");

function noop(obj, enc, done) {
	done(null, obj);
}

function generateVendorFilename(bundleFileName) {
	var parsed = path.parse(bundleFileName);

	return path.join(
		parsed.dir,
		parsed.name + ".vendor" + parsed.ext
	);
}

function vendorify(b, opts) {
	if (!opts.o && !opts.outfile && !b.argv.outfile) {
		throw new Error("You must set at least some --outfile option");
	}

	opts = opts || { };
	opts.debug = opts.debug || false;
	opts.outfile = opts.o || opts.outfile || generateVendorFilename(b.argv.outfile);

	var out;

	if (typeof opts.outfile === "string") {
		out = function () {
			return fs.createWriteStream(opts.outfile);
		};
	}
	else if (typeof opts.outfile === "function") {
		out = opts.outfile;
	}
	else {
		throw new Error("Wait, what is it?");
	}

	var files = null;
	var exposed = [];
	var updated = [];

	function needBundle() {
		if (files === null) {
			return true;
		}

		for (var ui = 0, ul = updated.length; ui < ul; ui++) {
			for (var fi = 0, fl = files.length; fi < fl; fi++) {
				if (updated[ui] === files[fi]) {
					return true;
				}
			}
		}

		return false;
	}

	function track(row) {
		files.push(row.id);
		if (row.expose) {
			exposed.push(row.expose);
		}
	}

	function setup() {
		if (needBundle()) {
			exposed.forEach(function (ref) {
				var indx = b._external.indexOf(ref);
				if (indx !== -1) {
					b._external.splice(indx, 1);
				}
			});

			var emitError = b.emit.bind(b, "error");
			var vendor = through.obj();

			files = [];
			updated = [];
			exposed = [];

			var flushed = vendor
				.on("error", emitError)
				.pipe(through.obj(function (row, enc, next) {
					track(row);
					next(null, row);
				}))
				.pipe(through.obj(function (row, enc, next) {
					row = opts.debug
						? row
						: Object.assign({ }, row, { nomap: true });
					next(null, row);
				}))
				.pipe(bpack({ raw: true, hasExports: true }))
				.on("error", emitError)
				.pipe(out())
				.on("error", emitError);

			b.pipeline.get("deps").push(vendorifyMdeps(vendor));
			b.pipeline.get("pack").push(through.obj(noop, function (end) {
				if (flushed.closed) {
					end();
				}
				else {
					flushed.once("finish", function () {
						end();
					});
				}
			}));
		}
		else {
			// if vendor file is already bundled
			// just hint browserify that they are external
			exposed.forEach(function (ref) {
				b.external(ref);
			});
		}
	}

	b.on("update", function (ids) {
		updated.push.apply(updated, ids);
	});

	b.on("reset", setup);
	setup();

	return b;
}

module.exports = vendorify;
