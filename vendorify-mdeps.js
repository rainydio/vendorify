"use strict";

var through = require("through2");

var REGEXP = process.platform === "win32"
	? /^(\.|\w:)/
	: /^[\/.]/;

function isExternalReference(id) {
	return !REGEXP.test(id);
}

function vendorifyMdeps(vendor) {
	var rows = { };
	var processed = [];
	var mainWaiting = [];
	var vendorWaiting = [];
	var required = { };
	var requireWaiting = [];

	var main;

	function waitOrProcess(id, waiting, process) {
		if (rows.hasOwnProperty(id)) {
			process(rows[id]);
		}
		else if (waiting.indexOf(id) === -1) {
			waiting.push(id);
		}
	}

	function processIfWaiting(row, waiting, process) {
		var indx = waiting.indexOf(row.id);
		if (indx !== -1) {
			waiting.splice(indx, 1);
			process(row);
		}
	}

	function processVendor(row) {
		if (processed.indexOf(row.id) !== -1) {
			return;
		}
		processed.push(row.id);

		Object.keys(row.deps).forEach(function (ref) {
			var depId = row.deps[ref];

			if (isExternalReference(ref) && required.hasOwnProperty(depId) === false) {
				if (requireWaiting.indexOf(depId) === -1) {
					requireWaiting.push(depId);
				}
			}
			else {
				waitOrProcess(depId, vendorWaiting, processVendor);
			}
		});

		if (required.hasOwnProperty(row.id)) {
			row = Object.assign({ }, row, {
				expose: required[row.id],
			});
		}

		vendor.push(row);
	}

	function processMain(row) {
		if (processed.indexOf(row.id) !== -1) {
			return;
		}
		processed.push(row.id);

		var deps = { };

		Object.keys(row.deps).forEach(function (ref) {
			var depId = row.deps[ref];

			if (isExternalReference(ref)) {
				deps[ref] = false;
				required[depId] = ref;

				var indx = requireWaiting.indexOf(depId) !== -1;
				if (indx !== -1) {
					requireWaiting.splice(indx, 1);
				}

				waitOrProcess(depId, vendorWaiting, processVendor);
			}
			else {
				deps[ref] = depId;
				waitOrProcess(depId, mainWaiting, processMain);
			}
		});

		main.push(Object.assign({ }, row, {
			deps: deps,
		}));
	}

	main = through.obj(function (row, enc, next) {
		rows[row.id] = row;

		processIfWaiting(row, mainWaiting, processMain);
		processIfWaiting(row, vendorWaiting, processVendor);

		if (row.entry) {
			processMain(row);
		}

		next();
	}, function (finish) {
		vendor.end();
		finish();
	});

	return main;
}

module.exports = vendorifyMdeps;
