"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeApiUrl = sanitizeApiUrl;
exports.getBackendApiUrl = getBackendApiUrl;
exports.isRecord = isRecord;
exports.getStringValue = getStringValue;
exports.getNumberValue = getNumberValue;
exports.getResponseCandidates = getResponseCandidates;
const DEFAULT_BACKEND_API_URL = "http://localhost:8080";
function sanitizeApiUrl(value) {
    if (!value || value.trim().length === 0) {
        return DEFAULT_BACKEND_API_URL;
    }
    return value.replace(/\/+$/, "");
}
function getBackendApiUrl(path) {
    const baseUrl = sanitizeApiUrl(process.env.BACKEND_API_URL);
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (baseUrl.endsWith("/api/v1") && normalizedPath.startsWith("/api/v1")) {
        const suffix = normalizedPath.slice("/api/v1".length);
        return `${baseUrl}${suffix}`;
    }
    return `${baseUrl}${normalizedPath}`;
}
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function getStringValue(record, key) {
    const value = record === null || record === void 0 ? void 0 : record[key];
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
function getNumberValue(record, key) {
    const value = record === null || record === void 0 ? void 0 : record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function getResponseCandidates(payload) {
    const primary = isRecord(payload) ? payload : null;
    const candidates = [];
    if (!primary) {
        return candidates;
    }
    candidates.push(primary);
    if (isRecord(primary.data)) {
        candidates.push(primary.data);
    }
    if (isRecord(primary.session)) {
        candidates.push(primary.session);
    }
    if (isRecord(primary.tokens)) {
        candidates.push(primary.tokens);
    }
    return candidates;
}
