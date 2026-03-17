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
(0, node_test_1.default)("parseProgressPercent keeps values in the 0..100 range", () => {
    strict_1.default.equal((0, materials_form_1.parseProgressPercent)("0", 50), 0);
    strict_1.default.equal((0, materials_form_1.parseProgressPercent)("100", 50), 100);
    strict_1.default.equal((0, materials_form_1.parseProgressPercent)("101", 50), 50);
    strict_1.default.equal((0, materials_form_1.parseProgressPercent)("-1", 50), 50);
});
(0, node_test_1.default)("normalizeProgressPercent rounds and clamps progress values", () => {
    strict_1.default.equal((0, materials_form_1.normalizeProgressPercent)(49.6), 50);
    strict_1.default.equal((0, materials_form_1.normalizeProgressPercent)(-10), 0);
    strict_1.default.equal((0, materials_form_1.normalizeProgressPercent)(130), 100);
    strict_1.default.equal((0, materials_form_1.normalizeProgressPercent)(Number.NaN), 0);
});
