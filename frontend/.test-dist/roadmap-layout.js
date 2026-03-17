"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRoadmapConnections = buildRoadmapConnections;
exports.readGraphSize = readGraphSize;
function buildRoadmapConnections(roadmap, containerRect, topicRects) {
    const connections = [];
    for (const stage of roadmap.stages) {
        for (const topic of stage.topics) {
            const toRect = topicRects.get(topic.id);
            if (!toRect) {
                continue;
            }
            for (const prerequisiteTopicId of topic.prerequisiteTopicIds) {
                const fromRect = topicRects.get(prerequisiteTopicId);
                if (!fromRect) {
                    continue;
                }
                connections.push({
                    fromId: prerequisiteTopicId,
                    toId: topic.id,
                    x1: fromRect.left + fromRect.width / 2 - containerRect.left,
                    y1: fromRect.bottom - containerRect.top,
                    x2: toRect.left + toRect.width / 2 - containerRect.left,
                    y2: toRect.top - containerRect.top
                });
            }
        }
    }
    return connections;
}
function readGraphSize(element) {
    return {
        width: Math.max(element.clientWidth, 1),
        height: Math.max(element.clientHeight, 1)
    };
}
