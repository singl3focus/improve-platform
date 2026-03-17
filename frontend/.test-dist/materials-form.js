"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePositiveInteger = parsePositiveInteger;
exports.parseProgressPercent = parseProgressPercent;
exports.normalizeProgressPercent = normalizeProgressPercent;
function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        return fallback;
    }
    return parsed;
}
function parseProgressPercent(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        return fallback;
    }
    return parsed;
}
function normalizeProgressPercent(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    const rounded = Math.round(value);
    if (rounded < 0) {
        return 0;
    }
    if (rounded > 100) {
        return 100;
    }
    return rounded;
}
