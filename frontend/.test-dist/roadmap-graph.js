"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROADMAP_WHEEL_SCALE_STEP = exports.ROADMAP_MIN_BEZIER_CONTROL = exports.ROADMAP_CONNECTION_RIGHT_SIDE_GAP = exports.ROADMAP_CONNECTION_ARROW_GAP = void 0;
exports.getConnectionAnchorOffsetDistance = getConnectionAnchorOffsetDistance;
exports.parsePositiveInteger = parsePositiveInteger;
exports.buildConnectionPath = buildConnectionPath;
exports.getConnectionAnchorSides = getConnectionAnchorSides;
exports.offsetConnectionAnchorPoint = offsetConnectionAnchorPoint;
exports.normalizeGraphPoint = normalizeGraphPoint;
exports.clampGraphScale = clampGraphScale;
exports.getGraphOffsetForScale = getGraphOffsetForScale;
exports.getRoadmapWheelZoomBehavior = getRoadmapWheelZoomBehavior;
exports.isDragGesture = isDragGesture;
exports.ROADMAP_CONNECTION_ARROW_GAP = 0;
exports.ROADMAP_CONNECTION_RIGHT_SIDE_GAP = 0;
exports.ROADMAP_MIN_BEZIER_CONTROL = 18;
exports.ROADMAP_WHEEL_SCALE_STEP = 0.12;
function getConnectionAnchorOffsetDistance(side) {
    return side === "right" ? exports.ROADMAP_CONNECTION_RIGHT_SIDE_GAP : exports.ROADMAP_CONNECTION_ARROW_GAP;
}
function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        return fallback;
    }
    return parsed;
}
function buildConnectionPath(x1, y1, x2, y2) {
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        const controlX = x1 + Math.sign(deltaX || 1) * Math.max(Math.abs(deltaX) * 0.5, exports.ROADMAP_MIN_BEZIER_CONTROL);
        return `M ${x1} ${y1} C ${controlX} ${y1}, ${controlX} ${y2}, ${x2} ${y2}`;
    }
    const controlY = y1 + Math.sign(deltaY || 1) * Math.max(Math.abs(deltaY) * 0.5, exports.ROADMAP_MIN_BEZIER_CONTROL);
    return `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}`;
}
function getConnectionAnchorSides(sourcePoint, targetPoint) {
    const deltaX = targetPoint.x - sourcePoint.x;
    const deltaY = targetPoint.y - sourcePoint.y;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        return deltaX >= 0
            ? { sourceSide: "right", targetSide: "left" }
            : { sourceSide: "left", targetSide: "right" };
    }
    return deltaY >= 0
        ? { sourceSide: "bottom", targetSide: "top" }
        : { sourceSide: "top", targetSide: "bottom" };
}
function offsetConnectionAnchorPoint(point, side, distance = getConnectionAnchorOffsetDistance(side)) {
    if (distance <= 0) {
        return point;
    }
    if (side === "left") {
        return {
            x: point.x - distance,
            y: point.y
        };
    }
    if (side === "right") {
        return {
            x: point.x + distance,
            y: point.y
        };
    }
    if (side === "top") {
        return {
            x: point.x,
            y: point.y - distance
        };
    }
    return {
        x: point.x,
        y: point.y + distance
    };
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
function getRoadmapWheelZoomBehavior(deltaY, viewportWidth, mobileBreakpoint, step = exports.ROADMAP_WHEEL_SCALE_STEP) {
    const isDesktopViewport = Number.isFinite(viewportWidth) && viewportWidth > mobileBreakpoint;
    if (!isDesktopViewport || !Number.isFinite(deltaY) || deltaY === 0) {
        return {
            preventPageScroll: false,
            scaleDelta: 0
        };
    }
    return {
        preventPageScroll: true,
        scaleDelta: deltaY > 0 ? -step : step
    };
}
function isDragGesture(start, current, threshold = 8) {
    return Math.hypot(current.x - start.x, current.y - start.y) >= threshold;
}
