"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePositiveInteger = parsePositiveInteger;
exports.buildConnectionPath = buildConnectionPath;
exports.normalizeGraphPoint = normalizeGraphPoint;
exports.clampGraphScale = clampGraphScale;
exports.getGraphOffsetForScale = getGraphOffsetForScale;
exports.isDragGesture = isDragGesture;
function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        return fallback;
    }
    return parsed;
}
function buildConnectionPath(x1, y1, x2, y2) {
    const controlY = y1 + Math.max((y2 - y1) * 0.5, 36);
    return `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}`;
}
function normalizeGraphPoint(clientX, clientY, graphOffset, transform) {
    const nextPoint = {
        x: clientX - graphOffset.left,
        y: clientY - graphOffset.top
    };
    if (!transform) {
        return nextPoint;
    }
    return {
        x: (nextPoint.x - transform.offsetX) / transform.scale,
        y: (nextPoint.y - transform.offsetY) / transform.scale
    };
}
function clampGraphScale(value, min = 0.6, max = 1.8) {
    if (Number.isNaN(value)) {
        return min;
    }
    return Math.min(Math.max(value, min), max);
}
function getGraphOffsetForScale(anchor, current, nextScale) {
    const worldX = (anchor.x - current.offsetX) / current.scale;
    const worldY = (anchor.y - current.offsetY) / current.scale;
    return {
        x: anchor.x - worldX * nextScale,
        y: anchor.y - worldY * nextScale
    };
}
function isDragGesture(start, current, threshold = 8) {
    return Math.hypot(current.x - start.x, current.y - start.y) >= threshold;
}
