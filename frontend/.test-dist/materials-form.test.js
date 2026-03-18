"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const materials_form_1 = require("./materials-form");
(0, node_test_1.default)("parsePositiveInteger parses valid numbers and falls back for invalid input", () => {
    strict_1.default.equal((0, materials_form_1.parsePositiveInteger)("5", 1), 5);
    strict_1.default.equal((0, materials_form_1.parsePositiveInteger)("0", 1), 1);
    strict_1.default.equal((0, materials_form_1.parsePositiveInteger)("-2", 1), 1);
    strict_1.default.equal((0, materials_form_1.parsePositiveInteger)("abc", 1), 1);
});
(0, node_test_1.default)("parseNonNegativeInteger parses non-negative values and falls back for invalid input", () => {
    strict_1.default.equal((0, materials_form_1.parseNonNegativeInteger)("0", 7), 0);
    strict_1.default.equal((0, materials_form_1.parseNonNegativeInteger)("14", 7), 14);
    strict_1.default.equal((0, materials_form_1.parseNonNegativeInteger)("-1", 7), 7);
    strict_1.default.equal((0, materials_form_1.parseNonNegativeInteger)("abc", 7), 7);
});
(0, node_test_1.default)("normalizeProgressPercent rounds and clamps progress values", () => {
    strict_1.default.equal((0, materials_form_1.normalizeProgressPercent)(49.6), 50);
    strict_1.default.equal((0, materials_form_1.normalizeProgressPercent)(-10), 0);
    strict_1.default.equal((0, materials_form_1.normalizeProgressPercent)(130), 100);
    strict_1.default.equal((0, materials_form_1.normalizeProgressPercent)(Number.NaN), 0);
});
(0, node_test_1.default)("resolveUnitByType maps supported material types to expected units", () => {
    strict_1.default.equal((0, materials_form_1.resolveUnitByType)("book"), "pages");
    strict_1.default.equal((0, materials_form_1.resolveUnitByType)("article"), "pages");
    strict_1.default.equal((0, materials_form_1.resolveUnitByType)("course"), "lessons");
    strict_1.default.equal((0, materials_form_1.resolveUnitByType)("video"), "hours");
});
(0, node_test_1.default)("computeProgressPercent calculates bounded progress from completed/total amounts", () => {
    strict_1.default.equal((0, materials_form_1.computeProgressPercent)(200, 40), 20);
    strict_1.default.equal((0, materials_form_1.computeProgressPercent)(0, 10), 0);
    strict_1.default.equal((0, materials_form_1.computeProgressPercent)(10, 30), 100);
    strict_1.default.equal((0, materials_form_1.computeProgressPercent)(10, -3), 0);
});
