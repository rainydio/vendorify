"use strict";

var fs = require("fs");
var path = require("path");
var through = require("through2");
var browserify = require("browserify");
var arrsome = require("array-some");
var arrdiff = require("array-difference");
var objassign = require("object-assign");
var objpick = require("object.pick");

function noop(obj, enc, done) {
	done(null, obj);
}

var optionsToCopy = [
	"extensions",
	"ignoreTransform",
	"fullPaths",
	"builtins",
	"commondir",
	"basedir",
	"browserField",
	"dedupe",
	"detectGlobals",
	"insertGlobals",
	"insertGlobalVars",
	"ignoreMissing",
	"cache",
	"pkgCache",
];

function isExternalModule(id) {
	var regexp = process.platform === "win32"
		? /^(\.|\w:)/
		: /^[\/.]/;

	return !regexp.test(id);
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

	var externals = [];
	var bundledExternals = [];
	var bundledFiles = [];
	var updatedFiles = [];

	b._options.bundleExternal = false;

	var bbOpts = objassign({ }, objpick(b._options, optionsToCopy));
	var bb = browserify(bbOpts);

	function bundle(done) {
		var filesUpdated = arrsome(updatedFiles, function (f) {
			return bundledFiles.indexOf(f) !== -1;
		});
		var externalsUpdated = arrdiff(
			bundledExternals, externals
		).length !== 0;

		if (filesUpdated === false && externalsUpdated === false) {
			done();
			return;
		}

		bb.reset();
		bb._transforms = b._transforms;

		for (var i = 0, l = externals.length; i < l; i++) {
			bb.require(externals[i]);
		}

		var bundled = bb.bundle()
			.once("error", done);

		bundled.pipe(out())
			.once("error", done)
			.once("finish", function () {
				updatedFiles = [];
				bundledExternals = externals;
				done();
			});
	}

	function reset() {
		externals = [];

		b.pipeline.get("pack").unshift(through.obj(noop, bundle));
		b.pipeline.get("deps").push(through.obj(function (row, enc, done) {
			for (var dep in row.deps) {
				if (row.deps.hasOwnProperty(dep)) {
					if (row.deps[dep] === false && isExternalModule(dep)) {
						if (externals.indexOf(dep) === -1) {
							externals.push(dep);
						}
					}
				}
			}
			done(null, row);
		}));
	}

	bb.on("error", b.emit.bind(b, "error"));
	bb.on("file", b.emit.bind(b, "file"));

	bb.on("file", function (file) {
		bundledFiles.push(file);
	});
	b.on("update", function (files) {
		updatedFiles.push.apply(updatedFiles, files);
	});

	b.on("reset", reset);
	reset();

	return b;
}

module.exports = vendorify;
