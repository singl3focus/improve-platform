"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareTopicsByPosition = compareTopicsByPosition;
exports.buildTopicGridColumnById = buildTopicGridColumnById;
exports.buildTopicGridPlacementById = buildTopicGridPlacementById;
exports.buildRoadmapConnections = buildRoadmapConnections;
exports.readGraphSize = readGraphSize;
const roadmap_types_1 = require("./roadmap-types");
const roadmap_graph_1 = require("./roadmap-graph");
function compareTopicsByPosition(leftTopic, rightTopic) {
    if (leftTopic.position !== rightTopic.position) {
        return leftTopic.position - rightTopic.position;
    }
    return leftTopic.id.localeCompare(rightTopic.id);
}
function buildTopicGridColumnById(stages) {
    const placementById = buildTopicGridPlacementById(stages);
    const map = new Map();
    for (const [topicId, placement] of placementById.entries()) {
        map.set(topicId, placement.column);
    }
    return map;
}
function buildTopicGridKey(row, column) {
    return `${row}:${column}`;
}
function classifyDirection(parent, child) {
    if (child.position < parent.position) {
        return "left";
    }
    if (child.position > parent.position) {
        return "right";
    }
    return "below";
}
function getTopicRectCenter(rect) {
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + (rect.bottom - rect.top) / 2
    };
}
function getTopicRectAnchorPoint(rect, side, containerRect) {
    if (side === "left") {
        return {
            x: rect.left - containerRect.left,
            y: rect.top + (rect.bottom - rect.top) / 2 - containerRect.top
        };
    }
    if (side === "right") {
        return {
            x: rect.left + rect.width - containerRect.left,
            y: rect.top + (rect.bottom - rect.top) / 2 - containerRect.top
        };
    }
    if (side === "top") {
        return {
            x: rect.left + rect.width / 2 - containerRect.left,
            y: rect.top - containerRect.top
        };
    }
    return {
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.bottom - containerRect.top
    };
}
function buildTopicGridPlacementById(stages) {
    var _a;
    const topics = stages
        .flatMap((stage) => stage.topics)
        .slice()
        .sort(compareTopicsByPosition);
    const topicById = new Map(topics.map((topic) => [topic.id, topic]));
    const childIdsByParentId = new Map();
    for (const topic of topics) {
        const parentIds = topic.prerequisiteTopicIds.slice().sort();
        for (const parentId of parentIds) {
            if (!topicById.has(parentId)) {
                continue;
            }
            const childIds = (_a = childIdsByParentId.get(parentId)) !== null && _a !== void 0 ? _a : [];
            childIds.push(topic.id);
            childIdsByParentId.set(parentId, childIds);
        }
    }
    for (const childIds of childIdsByParentId.values()) {
        childIds.sort((leftId, rightId) => {
            const leftTopic = topicById.get(leftId);
            const rightTopic = topicById.get(rightId);
            if (!leftTopic || !rightTopic) {
                return leftId.localeCompare(rightId);
            }
            return compareTopicsByPosition(leftTopic, rightTopic);
        });
    }
    const placementById = new Map();
    const occupied = new Set();
    const occupy = (topicId, row, column) => {
        placementById.set(topicId, { row, column });
        occupied.add(buildTopicGridKey(row, column));
    };
    const placeWithDirection = (topicId, row, column, direction) => {
        let nextRow = row;
        let nextColumn = column;
        while (occupied.has(buildTopicGridKey(nextRow, nextColumn))) {
            if (direction === "left") {
                nextColumn -= 1;
            }
            else {
                nextColumn += 1;
            }
        }
        occupy(topicId, nextRow, nextColumn);
    };
    const placeChildren = (parentId) => {
        var _a;
        const parentPlacement = placementById.get(parentId);
        const parentTopic = topicById.get(parentId);
        if (!parentPlacement || !parentTopic) {
            return;
        }
        const children = ((_a = childIdsByParentId.get(parentId)) !== null && _a !== void 0 ? _a : [])
            .map((childId) => topicById.get(childId))
            .filter((topic) => Boolean(topic));
        const leftChildren = children.filter((child) => classifyDirection(parentTopic, child) === "left");
        const rightChildren = children.filter((child) => classifyDirection(parentTopic, child) === "right");
        const belowChildren = children.filter((child) => classifyDirection(parentTopic, child) === "below");
        for (const child of leftChildren) {
            if (placementById.has(child.id)) {
                continue;
            }
            placeWithDirection(child.id, parentPlacement.row, parentPlacement.column - 1, "left");
            placeChildren(child.id);
        }
        for (const child of rightChildren) {
            if (placementById.has(child.id)) {
                continue;
            }
            placeWithDirection(child.id, parentPlacement.row, parentPlacement.column + 1, "right");
            placeChildren(child.id);
        }
        for (const child of belowChildren) {
            if (placementById.has(child.id)) {
                continue;
            }
            placeWithDirection(child.id, parentPlacement.row + 1, parentPlacement.column, "below");
            placeChildren(child.id);
        }
    };
    const rootTopics = topics.filter((topic) => topic.prerequisiteTopicIds.length === 0);
    let rootColumn = 1;
    for (const topic of rootTopics) {
        if (placementById.has(topic.id)) {
            continue;
        }
        while (occupied.has(buildTopicGridKey(1, rootColumn))) {
            rootColumn += 1;
        }
        occupy(topic.id, 1, rootColumn);
        rootColumn += 1;
        placeChildren(topic.id);
    }
    let fallbackRow = Math.max(1, ...Array.from(placementById.values()).map((placement) => placement.row)) + 1;
    for (const topic of topics) {
        if (placementById.has(topic.id)) {
            continue;
        }
        let fallbackColumn = 1;
        while (occupied.has(buildTopicGridKey(fallbackRow, fallbackColumn))) {
            fallbackColumn += 1;
        }
        occupy(topic.id, fallbackRow, fallbackColumn);
        fallbackRow += 1;
        placeChildren(topic.id);
    }
    const minimumColumn = Math.min(...Array.from(placementById.values()).map((placement) => placement.column));
    if (minimumColumn < 1) {
        const offset = 1 - minimumColumn;
        for (const [topicId, placement] of placementById.entries()) {
            placementById.set(topicId, {
                row: placement.row,
                column: placement.column + offset
            });
        }
    }
    return placementById;
}
function buildRoadmapConnections(roadmap, containerRect, topicRects) {
    const connections = [];
    for (const topic of (0, roadmap_types_1.flattenRoadmapTopics)(roadmap)) {
        const toRect = topicRects.get(topic.id);
        if (!toRect) {
            continue;
        }
        for (const prerequisiteTopicId of topic.prerequisiteTopicIds) {
            const fromRect = topicRects.get(prerequisiteTopicId);
            if (!fromRect) {
                continue;
            }
            const anchorSides = (0, roadmap_graph_1.getConnectionAnchorSides)(getTopicRectCenter(fromRect), getTopicRectCenter(toRect));
            const sourcePoint = (0, roadmap_graph_1.offsetConnectionAnchorPoint)(getTopicRectAnchorPoint(fromRect, anchorSides.sourceSide, containerRect), anchorSides.sourceSide, (0, roadmap_graph_1.getConnectionAnchorOffsetDistance)(anchorSides.sourceSide));
            const targetPoint = (0, roadmap_graph_1.offsetConnectionAnchorPoint)(getTopicRectAnchorPoint(toRect, anchorSides.targetSide, containerRect), anchorSides.targetSide, (0, roadmap_graph_1.getConnectionAnchorOffsetDistance)(anchorSides.targetSide));
            connections.push({
                fromId: prerequisiteTopicId,
                toId: topic.id,
                x1: sourcePoint.x,
                y1: sourcePoint.y,
                x2: targetPoint.x,
                y2: targetPoint.y
            });
        }
    }
    return connections;
}
function readGraphSize(element) {
    var _a, _b;
    return {
        width: Math.max(element.clientWidth, (_a = element.scrollWidth) !== null && _a !== void 0 ? _a : 0, 1),
        height: Math.max(element.clientHeight, (_b = element.scrollHeight) !== null && _b !== void 0 ? _b : 0, 1)
    };
}
