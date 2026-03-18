"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePositiveInteger = parsePositiveInteger;
exports.parseNonNegativeInteger = parseNonNegativeInteger;
exports.resolveUnitByType = resolveUnitByType;
exports.computeProgressPercent = computeProgressPercent;
exports.normalizeProgressPercent = normalizeProgressPercent;
const materials_library_types_1 = require("./materials-library-types");
function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        return fallback;
    }
    return parsed;
}
function parseNonNegativeInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
        return fallback;
    }
    return parsed;
}
function resolveUnitByType(type) {
    return materials_library_types_1.MATERIAL_TYPE_TO_UNIT[type];
}
function computeProgressPercent(totalAmount, completedAmount) {
    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(completedAmount)) {
        return 0;
    }
    const boundedCompleted = Math.min(Math.max(completedAmount, 0), totalAmount);
    return normalizeProgressPercent((boundedCompleted / totalAmount) * 100);
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
