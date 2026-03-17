"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const backend_shared_1 = require("./backend-shared");
(0, node_test_1.default)("sanitizeApiUrl keeps default backend URL for empty value", () => {
    strict_1.default.equal((0, backend_shared_1.sanitizeApiUrl)(undefined), "http://localhost:8080");
    strict_1.default.equal((0, backend_shared_1.sanitizeApiUrl)("   "), "http://localhost:8080");
});
(0, node_test_1.default)("getBackendApiUrl does not duplicate /api/v1 when BACKEND_API_URL already has it", () => {
    const previous = process.env.BACKEND_API_URL;
    process.env.BACKEND_API_URL = "http://127.0.0.1:8080/api/v1";
    try {
        strict_1.default.equal((0, backend_shared_1.getBackendApiUrl)("/api/v1/roadmap"), "http://127.0.0.1:8080/api/v1/roadmap");
        strict_1.default.equal((0, backend_shared_1.getBackendApiUrl)("api/v1/tasks"), "http://127.0.0.1:8080/api/v1/tasks");
    }
    finally {
        if (previous === undefined) {
            delete process.env.BACKEND_API_URL;
        }
        else {
            process.env.BACKEND_API_URL = previous;
        }
    }
});
(0, node_test_1.default)("getBackendApiUrl appends path for host-only backend URL", () => {
    const previous = process.env.BACKEND_API_URL;
    process.env.BACKEND_API_URL = "http://127.0.0.1:8080";
    try {
        strict_1.default.equal((0, backend_shared_1.getBackendApiUrl)("/api/v1/roadmap"), "http://127.0.0.1:8080/api/v1/roadmap");
    }
    finally {
        if (previous === undefined) {
            delete process.env.BACKEND_API_URL;
        }
        else {
            process.env.BACKEND_API_URL = previous;
        }
    }
});
