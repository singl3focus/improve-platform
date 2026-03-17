"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenRoadmapTopics = flattenRoadmapTopics;
function flattenRoadmapTopics(roadmap) {
    var _a, _b;
    if (Array.isArray(roadmap.topics)) {
        return roadmap.topics;
    }
    const topics = [];
    for (const stage of (_a = roadmap.stages) !== null && _a !== void 0 ? _a : []) {
        for (const topic of (_b = stage.topics) !== null && _b !== void 0 ? _b : []) {
            topics.push(topic);
        }
    }
    return topics;
}
