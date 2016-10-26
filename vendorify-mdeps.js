"use strict";

var through = require("through2");

var REGEXP = process.platform === "win32"
	? /^(\.|\w:)/
	: /^[\/.]/;

function isExternalReference(id) {
	return !REGEXP.test(id);
}

function vendorifyMdeps(vendor) {
	var main;
	var rows = { };
	var references = { };
	var waiting = [];
	var processed = [];

	function processVendor(row) {
		if (processed.indexOf(row.id) !== -1) {
			return;
		}
		processed.push(row.id);

		Object.keys(row.deps).forEach(function (ref) {
			var depId = row.deps[ref];
			if (depId !== false) {
				processVendor(rows[depId]);
			}
		});

		var exposed = references.hasOwnProperty(row.id)
			? { id: references[row.id], expose: references[row.id] }
			: { };

		var deps = { };
		Object.keys(row.deps).forEach(function (ref) {
			var depId = row.deps[ref];

			if (depId === false) {
				deps[ref] = false;
			}
			else if (references.hasOwnProperty(depId)) {
				deps[ref] = references[depId];
			}
			else {
				deps[ref] = depId;
			}
		});

		row = Object.assign({ }, row, exposed, { deps: deps });

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

			if (depId === false) {
				deps[ref] = false;
			}
			else if (isExternalReference(ref)) {
				references[depId] = ref;
				deps[ref] = false;
			}
			else {
				deps[ref] = depId;

				if (rows.hasOwnProperty(depId)) {
					processMain(rows[depId]);
				}
				else if (waiting.indexOf(depId) === -1) {
					waiting.push(depId);
				}
			}
		});

		main.push(Object.assign({ }, row, {
			deps: deps,
		}));
	}

	main = through.obj(function (row, enc, next) {
		rows[row.id] = row;

		var indx = waiting.indexOf(row.id);
		if (indx !== -1) {
			waiting.splice(indx, 1);
			processMain(row);
		}

		if (row.entry) {
			processMain(row);
		}

		next();
	}, function (finish) {
		Object.keys(references).forEach(function (id) {
			processVendor(rows[id]);
		});
		vendor.end();
		finish();
	});

	return main;
}

module.exports = vendorifyMdeps;
