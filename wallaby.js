/* eslint-env es6 */

"use strict";

module.exports = function () {
	return {
		debug: false,

		files: [
			{ pattern: "index.js", instrument: true },
			{ pattern: "vendorify-mdeps.js", instrument: true },
		],
		tests: [
			"test.js",
		],
		testFramework: "tape",
		env: {
			type: "node",
			runner: "node",
		},
	};
};
