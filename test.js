"use strict";

var test = require("tape");
var through = require("through2");
var vendorifyMdeps = require("./vendorify-mdeps");

function prepare() {
	var input = through.obj();
	var mainRows = [];
	var vendorRows = [];
	var waitingDone = [];

	var vendor = through.obj();
	var main = input.pipe(vendorifyMdeps(vendor));

	main.on("data", function (row) {
		mainRows.push(row);
	});
	vendor.on("data", function (row) {
		vendorRows.push(row);
	});
	main.on("finish", function () {
		waitingDone.forEach(function (callback) {
			callback();
		});
	});

	function done(callback) {
		if (main.finished) {
			callback();
		}
		else {
			waitingDone.push(callback);
		}
	}

	return {
		input: input,
		main: mainRows,
		vendor: vendorRows,
		done: done,
	};
}

test("empty stream", function (t) {
	var p = prepare();
	p.input.end();

	t.deepEquals(p.main, []);
	t.deepEquals(p.vendor, []);
	t.end();
});

test("entry only", function (t) {
	var p = prepare();
	p.input.write({
		id: 1,
		entry: true,
		deps: { },
	});
	p.input.end();

	p.done(function () {
		t.deepEquals(p.main, [
			{ id: 1, deps: { }, entry: true },
		]);
		t.deepEquals(p.vendor, []);
		t.end();
	});
});

test("entry with internal reference", function (t) {
	var p = prepare();
	p.input.write({
		id: 2,
		deps: { },
	});
	p.input.write({
		id: 1,
		entry: true,
		deps: {
			"./internal": 2,
		},
	});
	p.input.end();

	p.done(function () {
		t.deepEquals(p.main, [
			{ id: 2, deps: { }},
			{ id: 1, deps: { "./internal": 2 }, entry: true },
		]);
		t.deepEquals(p.vendor, []);
		t.end();
	});
});

test("entry with internal reference reversed order", function (t) {
	var p = prepare();
	p.input.write({
		id: 1,
		entry: true,
		deps: {
			"./internal": 2,
		},
	});
	p.input.write({
		id: 2,
		deps: { },
	});
	p.input.end();

	p.done(function () {
		t.deepEquals(p.main, [
			{ id: 1, deps: { "./internal": 2 }, entry: true },
			{ id: 2, deps: { }},
		]);
		t.deepEquals(p.vendor, []);
		t.end();
	});
});

test("entry with external reference", function (t) {
	var p = prepare();
	p.input.write({
		id: 2,
		deps: { },
	});
	p.input.write({
		id: 1,
		entry: true,
		deps: {
			"external": 2,
		},
	});
	p.input.end();

	p.done(function () {
		t.deepEquals(p.main, [
			{ id: 1, deps: { "external": false }, entry: true },
		]);
		t.deepEquals(p.vendor, [
			{ id: 2, deps: { }, expose: "external" },
		]);
		t.end();
	});
});

test("entry with external tree of references", function (t) {
	var p = prepare();
	p.input.write({
		id: 3,
		deps: { },
	});
	p.input.write({
		id: 2,
		deps: {
			"./external-internal": 3,
		},
	});
	p.input.write({
		id: 1,
		deps: {
			"external": 2,
		},
		entry: true,
	});
	p.input.end();

	p.done(function () {
		t.deepEquals(p.main, [
			{ id: 1, deps: { "external": false }, entry: true },
		]);
		t.deepEquals(p.vendor, [
			{ id: 3, deps: { }},
			{ id: 2, deps: { "./external-internal": 3 }, expose: "external" },
		]);
		t.end();
	});
});
