import { createServer } from "node:http";

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL ?? "http://127.0.0.1:3025";
const MOCK_BACKEND_PORT = Number(process.env.MOCK_BACKEND_PORT ?? "8080");
const MOCK_BACKEND_HOST = process.env.MOCK_BACKEND_HOST ?? "127.0.0.1";
const MOCK_BACKEND_BASE_URL = `http://${MOCK_BACKEND_HOST}:${MOCK_BACKEND_PORT}`;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function nowIso(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString();
}

function createDefaultRoadmap() {
  return {
    id: "roadmap-web-basics",
    title: "Web basics",
    stages: [
      {
        id: "stage-foundations",
        title: "Foundations",
        position: 1,
        topics: [
          {
            id: "topic-html-css",
            stage_id: "stage-foundations",
            title: "HTML & CSS",
            description: "Core markup and styling skills.",
            status: "in_progress",
            start_date: nowIso(-7),
            target_date: nowIso(14),
            completed_date: null,
            is_blocked: false,
            block_reasons: [],
            dependencies: []
          }
        ]
      }
    ]
  };
}

function createMockState() {
  const tasks = [
    {
      id: "task-html-intro",
      topic_id: "topic-html-css",
      title: "Read HTML semantic tags guide",
      description: "Understand semantic page structure.",
      status: "new",
      deadline: nowIso(3),
      position: 1,
      is_overdue: false
    },
    {
      id: "task-css-layout",
      topic_id: "topic-html-css",
      title: "Practice CSS Grid layout",
      description: "Create dashboard-like layout blocks.",
      status: "paused",
      deadline: nowIso(-2),
      position: 2,
      is_overdue: true
    }
  ];

  const materials = [
    {
      id: "material-html-docs",
      topic_id: "topic-html-css",
      title: "MDN HTML reference",
      description: "Official HTML element documentation.",
      progress: 30,
      position: 1,
      updated_at: nowIso(-1)
    }
  ];

  return {
    roadmap: createDefaultRoadmap(),
    tasks,
    materials,
    taskCounter: 2,
    materialCounter: 1,
    roadmapCounter: 1,
    stageCounter: 1,
    topicCounter: 1,
    roadmapMode: "ok",
    taskDeleteMode: "ok"
  };
}

function parseJsonBody(request) {
  return new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      if (!raw) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function findTopicById(state, topicId) {
  for (const stage of state.roadmap?.stages ?? []) {
    for (const topic of stage.topics ?? []) {
      if (topic.id === topicId) {
        return topic;
      }
    }
  }
  return null;
}

function createMockBackendServer() {
  const state = createMockState();

  const server = createServer(async (request, response) => {
    if (!request.url) {
      sendJson(response, 400, { message: "Missing request URL.", code: "bad_request" });
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
    const method = request.method ?? "GET";
    const path = url.pathname;

    if (method === "POST" && path === "/__mock/scenario") {
      const payload = await parseJsonBody(request);
      const roadmapMode = payload?.roadmapMode;
      const taskDeleteMode = payload?.taskDeleteMode;

      if (roadmapMode === "ok" || roadmapMode === "not_found") {
        state.roadmapMode = roadmapMode;
      }
      if (taskDeleteMode === "ok" || taskDeleteMode === "error") {
        state.taskDeleteMode = taskDeleteMode;
      }

      sendJson(response, 200, {
        roadmapMode: state.roadmapMode,
        taskDeleteMode: state.taskDeleteMode
      });
      return;
    }

    if (method === "POST" && path === "/api/v1/auth/refresh") {
      sendJson(response, 401, {
        message: "Refresh token is invalid.",
        code: "invalid_refresh_token"
      });
      return;
    }

    if (method === "GET" && path === "/api/v1/roadmap") {
      if (state.roadmapMode === "not_found" || !state.roadmap) {
        sendJson(response, 404, {
          message: "Roadmap not found.",
          code: "roadmap_not_found"
        });
        return;
      }

      sendJson(response, 200, state.roadmap);
      return;
    }

    if (method === "POST" && path === "/api/v1/roadmap") {
      const payload = await parseJsonBody(request);
      const title = typeof payload?.title === "string" ? payload.title.trim() : "";
      if (!title) {
        sendJson(response, 400, { message: "title is required", code: "validation_error" });
        return;
      }

      if (state.roadmapMode !== "not_found" && state.roadmap) {
        sendJson(response, 409, {
          message: "roadmap already exists for this user",
          code: "roadmap_exists"
        });
        return;
      }

      state.roadmapCounter += 1;
      state.roadmap = {
        id: `roadmap-created-${state.roadmapCounter}`,
        title,
        stages: []
      };
      state.roadmapMode = "ok";
      sendJson(response, 201, state.roadmap);
      return;
    }

    if (method === "POST" && path === "/api/v1/roadmap/stages") {
      if (state.roadmapMode === "not_found" || !state.roadmap) {
        sendJson(response, 404, { message: "roadmap not found", code: "roadmap_not_found" });
        return;
      }

      const payload = await parseJsonBody(request);
      const title = typeof payload?.title === "string" ? payload.title.trim() : "";
      const position = Number(payload?.position ?? 1);
      if (!title) {
        sendJson(response, 400, { message: "title is required", code: "validation_error" });
        return;
      }

      state.stageCounter += 1;
      const stage = {
        id: `stage-created-${state.stageCounter}`,
        title,
        position: Number.isFinite(position) && position > 0 ? position : 1,
        topics: []
      };
      state.roadmap.stages.push(stage);
      sendJson(response, 201, stage);
      return;
    }

    if (method === "POST" && path === "/api/v1/roadmap/topics") {
      if (state.roadmapMode === "not_found" || !state.roadmap) {
        sendJson(response, 404, { message: "roadmap not found", code: "roadmap_not_found" });
        return;
      }

      const payload = await parseJsonBody(request);
      const stageId = typeof payload?.stage_id === "string" ? payload.stage_id : "";
      const title = typeof payload?.title === "string" ? payload.title.trim() : "";
      const description = typeof payload?.description === "string" ? payload.description : "";
      const position = Number(payload?.position ?? 1);

      if (!stageId || !title) {
        sendJson(response, 400, {
          message: "stage_id and title are required",
          code: "validation_error"
        });
        return;
      }

      const stage = state.roadmap.stages.find((item) => item.id === stageId);
      if (!stage) {
        sendJson(response, 404, { message: "stage not found", code: "stage_not_found" });
        return;
      }

      state.topicCounter += 1;
      const topic = {
        id: `topic-created-${state.topicCounter}`,
        stage_id: stageId,
        title,
        description,
        status: "not_started",
        start_date: null,
        target_date: null,
        completed_date: null,
        is_blocked: false,
        block_reasons: [],
        dependencies: [],
        position: Number.isFinite(position) && position > 0 ? position : 1
      };
      stage.topics.push(topic);
      sendJson(response, 201, topic);
      return;
    }

    {
      const topicMatch = path.match(/^\/api\/v1\/roadmap\/topics\/([^/]+)$/);
      if (method === "GET" && topicMatch) {
        const topicId = decodeURIComponent(topicMatch[1]);
        const topic = findTopicById(state, topicId);
        if (!topic) {
          sendJson(response, 404, { message: "Topic not found.", code: "topic_not_found" });
          return;
        }
        sendJson(response, 200, topic);
        return;
      }
    }

    {
      const topicTasksMatch = path.match(/^\/api\/v1\/roadmap\/topics\/([^/]+)\/tasks$/);
      if (method === "GET" && topicTasksMatch) {
        const topicId = decodeURIComponent(topicTasksMatch[1]);
        if (!findTopicById(state, topicId)) {
          sendJson(response, 404, { message: "Topic not found.", code: "topic_not_found" });
          return;
        }

        const topicTasks = state.tasks
          .filter((task) => task.topic_id === topicId)
          .sort((left, right) => left.position - right.position);
        const done = topicTasks.filter((task) => task.status === "done").length;
        const total = topicTasks.length;

        sendJson(response, 200, {
          topic_id: topicId,
          total,
          done,
          percent: total > 0 ? Math.round((done / total) * 100) : 0,
          tasks: topicTasks
        });
        return;
      }
    }

    {
      const topicMaterialsMatch = path.match(/^\/api\/v1\/roadmap\/topics\/([^/]+)\/materials$/);
      if (method === "GET" && topicMaterialsMatch) {
        const topicId = decodeURIComponent(topicMaterialsMatch[1]);
        if (!findTopicById(state, topicId)) {
          sendJson(response, 404, { message: "Topic not found.", code: "topic_not_found" });
          return;
        }

        const topicMaterials = state.materials
          .filter((material) => material.topic_id === topicId)
          .sort((left, right) => left.position - right.position);
        sendJson(response, 200, topicMaterials);
        return;
      }
    }

    if (method === "GET" && path === "/api/v1/tasks") {
      const topicId = url.searchParams.get("topic_id");
      const tasks = topicId
        ? state.tasks.filter((task) => task.topic_id === topicId)
        : state.tasks.slice();
      sendJson(response, 200, tasks);
      return;
    }

    if (method === "POST" && path === "/api/v1/tasks") {
      const payload = await parseJsonBody(request);
      const title = typeof payload?.title === "string" ? payload.title.trim() : "";
      const description = typeof payload?.description === "string" ? payload.description : "";
      const topicId = typeof payload?.topic_id === "string" ? payload.topic_id : null;
      const deadline =
        typeof payload?.deadline === "string" && payload.deadline.trim().length > 0
          ? payload.deadline
          : null;

      if (!title) {
        sendJson(response, 400, { message: "title is required", code: "validation_error" });
        return;
      }

      if (topicId && !findTopicById(state, topicId)) {
        sendJson(response, 404, { message: "Topic not found.", code: "topic_not_found" });
        return;
      }

      state.taskCounter += 1;
      const created = {
        id: `task-created-${state.taskCounter}`,
        topic_id: topicId,
        title,
        description,
        status: "new",
        deadline,
        position: Number(payload?.position ?? 0),
        is_overdue: Boolean(deadline && new Date(deadline).getTime() < Date.now())
      };
      state.tasks.unshift(created);
      sendJson(response, 201, created);
      return;
    }

    {
      const taskByIdMatch = path.match(/^\/api\/v1\/tasks\/([^/]+)$/);
      if (taskByIdMatch) {
        const taskId = decodeURIComponent(taskByIdMatch[1]);
        const taskIndex = state.tasks.findIndex((item) => item.id === taskId);
        const task = taskIndex >= 0 ? state.tasks[taskIndex] : null;

        if (method === "GET") {
          if (!task) {
            sendJson(response, 404, { message: "Task not found.", code: "task_not_found" });
            return;
          }

          sendJson(response, 200, task);
          return;
        }

        if (method === "DELETE") {
          if (!task) {
            sendJson(response, 404, { message: "Task not found.", code: "task_not_found" });
            return;
          }
          if (state.taskDeleteMode === "error") {
            sendJson(response, 500, {
              message: "Task removal failed in mock backend.",
              code: "task_delete_failed"
            });
            return;
          }

          state.tasks.splice(taskIndex, 1);
          sendJson(response, 200, { success: true });
          return;
        }
      }
    }

    {
      const taskStatusMatch = path.match(/^\/api\/v1\/tasks\/([^/]+)\/status$/);
      if (method === "PATCH" && taskStatusMatch) {
        const taskId = decodeURIComponent(taskStatusMatch[1]);
        const payload = await parseJsonBody(request);
        const status = payload?.status;
        const task = state.tasks.find((item) => item.id === taskId);

        if (!task) {
          sendJson(response, 404, { message: "Task not found.", code: "task_not_found" });
          return;
        }

        if (!["new", "in_progress", "paused", "done"].includes(status)) {
          sendJson(response, 422, { message: "Invalid task status.", code: "validation_error" });
          return;
        }

        task.status = status;
        task.is_overdue = Boolean(task.deadline && new Date(task.deadline).getTime() < Date.now());
        sendJson(response, 200, task);
        return;
      }
    }

    if (method === "POST" && path === "/api/v1/materials") {
      const payload = await parseJsonBody(request);
      const topicId = typeof payload?.topic_id === "string" ? payload.topic_id : "";
      if (!findTopicById(state, topicId)) {
        sendJson(response, 404, { message: "Topic not found.", code: "topic_not_found" });
        return;
      }

      state.materialCounter += 1;
      const now = nowIso(0);
      const created = {
        id: `material-created-${state.materialCounter}`,
        topic_id: topicId,
        title: String(payload?.title ?? ""),
        description: String(payload?.description ?? ""),
        progress: Number(payload?.progress ?? 0),
        position: Number(payload?.position ?? 1),
        updated_at: now
      };
      state.materials.push(created);
      sendJson(response, 201, created);
      return;
    }

    {
      const materialByIdMatch = path.match(/^\/api\/v1\/materials\/([^/]+)$/);
      if (materialByIdMatch) {
        const materialId = decodeURIComponent(materialByIdMatch[1]);
        const materialIndex = state.materials.findIndex((item) => item.id === materialId);

        if (materialIndex < 0) {
          sendJson(response, 404, { message: "Material not found.", code: "material_not_found" });
          return;
        }

        const material = state.materials[materialIndex];

        if (method === "GET") {
          sendJson(response, 200, material);
          return;
        }

        if (method === "PUT") {
          const payload = await parseJsonBody(request);
          material.title = String(payload?.title ?? material.title);
          material.description = String(payload?.description ?? material.description);
          material.position = Number(payload?.position ?? material.position);
          material.progress = Number(payload?.progress ?? material.progress);
          material.updated_at = nowIso(0);
          sendJson(response, 200, material);
          return;
        }

        if (method === "DELETE") {
          state.materials.splice(materialIndex, 1);
          sendJson(response, 200, { success: true });
          return;
        }
      }
    }

    sendJson(response, 404, { message: "Route not found.", code: "route_not_found" });
  });

  return {
    start: () =>
      new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(MOCK_BACKEND_PORT, MOCK_BACKEND_HOST, () => {
          server.removeListener("error", reject);
          resolve();
        });
      }),
    stop: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      })
  };
}

async function request(pathname, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (init.body && !("Content-Type" in headers)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${FRONTEND_BASE_URL}${pathname}`, {
    redirect: "manual",
    ...init,
    headers
  });

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.toLowerCase().includes("application/json");

  let body = null;
  if (isJson) {
    body = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => "");
    body = text.length > 0 ? text : null;
  }

  return {
    status: response.status,
    body,
    headers: response.headers
  };
}

async function setMockScenario(patch) {
  const response = await fetch(`${MOCK_BACKEND_BASE_URL}/__mock/scenario`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });

  invariant(response.ok, `Failed to set mock scenario. Got ${response.status}.`);
}

async function run() {
  const checks = [];
  const backend = createMockBackendServer();

  async function check(name, fn) {
    try {
      await fn();
      checks.push({ name, status: "PASS" });
    } catch (error) {
      checks.push({
        name,
        status: "FAIL",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  await backend.start();

  try {
    await check("Auth guard redirects unauthenticated private route", async () => {
      const response = await request("/dashboard");
      invariant(response.status === 307 || response.status === 308, `Expected 307/308, got ${response.status}`);
      const location = response.headers.get("location") ?? "";
      invariant(location.includes("/login"), `Expected redirect to /login, got "${location}"`);
    });

    await check("Auth endpoint validates payload", async () => {
      const response = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({})
      });
      invariant(response.status === 400, `Expected 400, got ${response.status}`);
      invariant(typeof response.body?.message === "string", "Expected JSON validation error message.");
    });

    await check("Roadmap GET route keeps response shape", async () => {
      const response = await request("/api/roadmap");
      invariant(response.status === 200, `Expected 200, got ${response.status}`);
      invariant(Array.isArray(response.body?.stages), "Expected stages array.");
      invariant(response.body.stages.length > 0, "Expected non-empty stages list.");

      const firstStage = response.body.stages[0];
      invariant(typeof firstStage?.id === "string", "Expected stage id.");
      invariant(Array.isArray(firstStage?.topics), "Expected topics array in stage.");
      invariant(firstStage.topics.length > 0, "Expected at least one topic in roadmap stage.");

      const firstTopic = firstStage.topics[0];
      invariant(typeof firstTopic?.id === "string", "Expected topic id.");
      invariant(typeof firstTopic?.title === "string", "Expected topic title.");
      invariant(typeof firstTopic?.progressPercent === "number", "Expected topic progressPercent number.");
      invariant(typeof firstTopic?.tasksCount === "number", "Expected topic tasksCount number.");
      invariant(typeof firstTopic?.materialsCount === "number", "Expected topic materialsCount number.");
      invariant(Array.isArray(firstTopic?.prerequisiteTopicIds), "Expected prerequisiteTopicIds array.");
    });

    await check("Roadmap GET route keeps empty fallback when backend returns roadmap_not_found", async () => {
      await setMockScenario({ roadmapMode: "not_found" });
      try {
        const response = await request("/api/roadmap");
        invariant(response.status === 200, `Expected 200 fallback, got ${response.status}`);
        invariant(Array.isArray(response.body?.stages), "Expected stages array.");
        invariant(response.body.stages.length === 0, "Expected empty stages for roadmap_not_found.");
      } finally {
        await setMockScenario({ roadmapMode: "ok" });
      }
    });

    await check("Topics GET route keeps success and fallback payload shapes", async () => {
      const success = await request("/api/topics/topic-html-css");
      invariant(success.status === 200, `Expected 200, got ${success.status}`);
      invariant(success.body?.id === "topic-html-css", "Expected requested topic id.");
      invariant(typeof success.body?.title === "string", "Expected topic title.");
      invariant(Array.isArray(success.body?.checklist), "Expected checklist array.");
      invariant(Array.isArray(success.body?.materials), "Expected materials array.");
      invariant(Array.isArray(success.body?.dependencies), "Expected dependencies array.");
      invariant(success.body.checklist.length > 0, "Expected non-empty checklist for existing topic.");

      const fallback = await request("/api/topics/topic-unknown");
      invariant(fallback.status === 200, `Expected 200 fallback, got ${fallback.status}`);
      invariant(fallback.body?.id === "topic-unknown", "Expected fallback payload with requested topic id.");
      invariant(Array.isArray(fallback.body?.checklist), "Expected fallback checklist array.");
      invariant(Array.isArray(fallback.body?.materials), "Expected fallback materials array.");
      invariant(fallback.body.checklist.length === 0, "Expected empty checklist for missing topic.");
    });

    await check("Topics checklist PATCH route keeps success and key error statuses", async () => {
      const success = await request("/api/topics/topic-html-css/checklist/task-html-intro", {
        method: "PATCH",
        body: JSON.stringify({ status: "in_progress" })
      });
      invariant(success.status === 200, `Expected 200, got ${success.status}`);
      invariant(success.body?.success === true, "Expected success=true payload.");

      const invalidStatus = await request("/api/topics/topic-html-css/checklist/task-html-intro", {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" })
      });
      invariant(invalidStatus.status === 422, `Expected 422, got ${invalidStatus.status}`);

      const invalidJson = await request("/api/topics/topic-html-css/checklist/task-html-intro", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{invalid-json}"
      });
      invariant(invalidJson.status === 400, `Expected 400, got ${invalidJson.status}`);

      const missing = await request("/api/topics/topic-html-css/checklist/task-does-not-exist", {
        method: "PATCH",
        body: JSON.stringify({ status: "todo" })
      });
      invariant(missing.status === 404, `Expected 404, got ${missing.status}`);
    });

    await check("Tasks GET route keeps response shape", async () => {
      const response = await request("/api/tasks?due=all");
      invariant(response.status === 200, `Expected 200, got ${response.status}`);
      invariant(Array.isArray(response.body?.tasks), "Expected tasks array.");
      invariant(Array.isArray(response.body?.topics), "Expected topics array.");
      invariant(response.body.tasks.length > 0, "Expected non-empty tasks list.");
    });

    await check("Tasks POST route keeps success and validation errors", async () => {
      const create = await request("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: "Smoke task",
          description: "Created by verification.",
          deadline: "2030-01-05"
        })
      });
      invariant(create.status === 201, `Create expected 201, got ${create.status}`);
      invariant(typeof create.body?.id === "string", "Expected created task id.");
      invariant(create.body?.status === "new", "Expected created task status = new.");

      const invalid = await request("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: "   "
        })
      });
      invariant(invalid.status === 422, `Invalid payload expected 422, got ${invalid.status}`);
    });

    await check("Tasks PATCH route supports kanban drop status transition", async () => {
      const listResponse = await request("/api/tasks?due=all");
      invariant(listResponse.status === 200, `Tasks preload expected 200, got ${listResponse.status}`);
      const taskId = listResponse.body.tasks[0].id;

      const success = await request(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "in_progress" })
      });
      invariant(success.status === 200, `Expected 200, got ${success.status}`);
      invariant(typeof success.body?.id === "string", "Expected task id in response.");
      invariant(success.body?.status === "in_progress", "Expected task status to change to in_progress.");

      const refreshedList = await request("/api/tasks?due=all");
      invariant(refreshedList.status === 200, `Expected refreshed board status 200, got ${refreshedList.status}`);
      const refreshedTask = refreshedList.body.tasks.find((task) => task.id === taskId);
      invariant(Boolean(refreshedTask), "Expected updated task to exist in refreshed board response.");
      invariant(
        refreshedTask.status === "in_progress",
        "Expected refreshed board task status to remain in_progress."
      );

      const invalid = await request(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" })
      });
      invariant(invalid.status === 422, `Invalid status expected 422, got ${invalid.status}`);

      const missing = await request("/api/tasks/task-does-not-exist/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "paused" })
      });
      invariant(missing.status === 404, `Missing task expected 404, got ${missing.status}`);
    });

    await check("Tasks DELETE route keeps success and removes task from board response", async () => {
      const create = await request("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: "Smoke task for delete flow",
          description: "Created and deleted by verification."
        })
      });
      invariant(create.status === 201, `Create expected 201, got ${create.status}`);
      const taskId = create.body.id;

      const deleted = await request(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "DELETE"
      });
      invariant(deleted.status === 200, `Delete expected 200, got ${deleted.status}`);
      invariant(deleted.body?.success === true, "Expected delete success=true.");

      const refreshedList = await request("/api/tasks?due=all");
      invariant(refreshedList.status === 200, `Expected refreshed board status 200, got ${refreshedList.status}`);
      const hasDeletedTask = refreshedList.body.tasks.some((task) => task.id === taskId);
      invariant(!hasDeletedTask, "Expected deleted task to be absent in refreshed board response.");
    });

    await check("Tasks DELETE route keeps task intact when backend delete fails", async () => {
      const create = await request("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: "Smoke task for delete failure flow",
          description: "Must remain after forced backend delete failure."
        })
      });
      invariant(create.status === 201, `Create expected 201, got ${create.status}`);
      const taskId = create.body.id;

      await setMockScenario({ taskDeleteMode: "error" });
      try {
        const failedDelete = await request(`/api/tasks/${encodeURIComponent(taskId)}`, {
          method: "DELETE"
        });
        invariant(failedDelete.status === 500, `Forced delete expected 500, got ${failedDelete.status}`);
      } finally {
        await setMockScenario({ taskDeleteMode: "ok" });
      }

      const refreshedList = await request("/api/tasks?due=all");
      invariant(refreshedList.status === 200, `Expected refreshed board status 200, got ${refreshedList.status}`);
      const hasTaskAfterFailedDelete = refreshedList.body.tasks.some((task) => task.id === taskId);
      invariant(hasTaskAfterFailedDelete, "Expected task to remain after failed delete call.");

      const cleanupDelete = await request(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "DELETE"
      });
      invariant(cleanupDelete.status === 200, `Cleanup delete expected 200, got ${cleanupDelete.status}`);
    });

    await check("Materials GET/POST keep response shape and validation errors", async () => {
      const list = await request("/api/materials");
      invariant(list.status === 200, `Expected 200, got ${list.status}`);
      invariant(Array.isArray(list.body?.materials), "Expected materials array.");
      invariant(Array.isArray(list.body?.topics), "Expected topics array.");
      invariant(list.body.topics.length > 0, "Expected non-empty topics list.");

      const topicId = list.body.topics[0].id;
      const create = await request("/api/materials", {
        method: "POST",
        body: JSON.stringify({
          title: "Smoke material",
          description: "Created by verification.",
          topicId,
          position: 7,
          progressPercent: 10
        })
      });
      invariant(create.status === 201, `Create expected 201, got ${create.status}`);
      invariant(typeof create.body?.id === "string", "Expected created material id.");

      const invalid = await request("/api/materials", {
        method: "POST",
        body: JSON.stringify({
          title: "Invalid material",
          description: "Invalid progress should fail",
          topicId,
          position: 1,
          progressPercent: 101
        })
      });
      invariant(invalid.status === 422, `Invalid payload expected 422, got ${invalid.status}`);
    });

    await check("Materials PATCH/DELETE keep success and key error statuses", async () => {
      const list = await request("/api/materials");
      invariant(list.status === 200, `Materials preload expected 200, got ${list.status}`);
      const topicId = list.body.topics[0].id;

      const created = await request("/api/materials", {
        method: "POST",
        body: JSON.stringify({
          title: "Patch-delete material",
          description: "Created for patch/delete checks.",
          topicId,
          position: 8,
          progressPercent: 0
        })
      });
      invariant(created.status === 201, `Create expected 201, got ${created.status}`);
      const materialId = created.body.id;

      const updated = await request(`/api/materials/${encodeURIComponent(materialId)}`, {
        method: "PATCH",
        body: JSON.stringify({ progressPercent: 35 })
      });
      invariant(updated.status === 200, `Patch expected 200, got ${updated.status}`);
      invariant(updated.body?.progressPercent === 35, "Expected updated progressPercent = 35.");

      const deleted = await request(`/api/materials/${encodeURIComponent(materialId)}`, {
        method: "DELETE"
      });
      invariant(deleted.status === 200, `Delete expected 200, got ${deleted.status}`);
      invariant(deleted.body?.success === true, "Expected delete success=true.");

      const missing = await request(`/api/materials/${encodeURIComponent(materialId)}`, {
        method: "PATCH",
        body: JSON.stringify({ progressPercent: 40 })
      });
      invariant(missing.status === 404, `Missing material expected 404, got ${missing.status}`);
    });

    await check("Dashboard routes keep core response shapes", async () => {
      const progress = await request("/api/dashboard/progress");
      invariant(progress.status === 200, `Progress expected 200, got ${progress.status}`);
      invariant(
        typeof progress.body?.roadmapProgressPercent === "number",
        "Expected roadmapProgressPercent number."
      );

      const upcoming = await request("/api/dashboard/upcoming-tasks");
      invariant(upcoming.status === 200, `Upcoming tasks expected 200, got ${upcoming.status}`);
      invariant(Array.isArray(upcoming.body), "Expected array payload for upcoming tasks.");
      if (upcoming.body.length > 0) {
        invariant(typeof upcoming.body[0].title === "string", "Expected task title.");
        invariant("topicTitle" in upcoming.body[0], "Expected topicTitle field in upcoming task item.");
      }
    });

    await check("Roadmap quick-create route creates first topic on empty roadmap", async () => {
      await setMockScenario({ roadmapMode: "not_found" });

      const create = await request("/api/roadmap/quick-create", {
        method: "POST",
        body: JSON.stringify({
          topicTitle: "Quick create topic",
          topicDescription: "Created by smoke scenario."
        })
      });
      invariant(create.status === 201, `Quick-create expected 201, got ${create.status}`);
      invariant(typeof create.body?.topicId === "string", "Expected created topicId in response.");

      const roadmap = await request("/api/roadmap");
      invariant(roadmap.status === 200, `Roadmap expected 200 after quick-create, got ${roadmap.status}`);
      invariant(Array.isArray(roadmap.body?.stages), "Expected roadmap stages array.");
      invariant(roadmap.body.stages.length > 0, "Expected at least one stage after quick-create.");

      const hasCreatedTopic = roadmap.body.stages.some(
        (stage) =>
          Array.isArray(stage?.topics) &&
          stage.topics.some((topic) => topic?.title === "Quick create topic")
      );
      invariant(hasCreatedTopic, "Expected quick-created topic in roadmap response.");
    });
  } finally {
    await backend.stop();
  }

  const failures = checks.filter((item) => item.status === "FAIL");

  console.log("Frontend MVP verification smoke");
  console.log(`Base URL: ${FRONTEND_BASE_URL}`);
  console.log(`Mock backend: http://${MOCK_BACKEND_HOST}:${MOCK_BACKEND_PORT}`);
  console.log("");
  console.log("Scenario results:");
  for (const result of checks) {
    if (result.status === "PASS") {
      console.log(`- PASS: ${result.name}`);
      continue;
    }
    console.log(`- FAIL: ${result.name}`);
    console.log(`  ${result.message}`);
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

await run();
