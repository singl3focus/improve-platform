import { randomUUID } from "node:crypto";

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL ?? "http://127.0.0.1:3025";
const SMOKE_RUN_ID =
  process.env.SMOKE_RUN_ID ??
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const SMOKE_AUTH_EMAIL = process.env.SMOKE_AUTH_EMAIL ?? `smoke.${SMOKE_RUN_ID}@example.com`;
const SMOKE_AUTH_PASSWORD = process.env.SMOKE_AUTH_PASSWORD ?? "SmokePassword123!";
const SMOKE_AUTH_FULL_NAME = process.env.SMOKE_AUTH_FULL_NAME ?? "Smoke User";

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getDateString(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  if (typeof headers.raw === "function") {
    const raw = headers.raw();
    if (Array.isArray(raw?.["set-cookie"])) {
      return raw["set-cookie"];
    }
  }

  const fallback = headers.get("set-cookie");
  return fallback ? [fallback] : [];
}

const cookieJar = new Map();

function clearCookies() {
  cookieJar.clear();
}

function storeResponseCookies(headers) {
  const setCookies = getSetCookieHeaders(headers);

  for (const entry of setCookies) {
    const firstPair = entry.split(";", 1)[0] ?? "";
    const separatorIndex = firstPair.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const name = firstPair.slice(0, separatorIndex).trim();
    const value = firstPair.slice(separatorIndex + 1).trim();
    if (!name) {
      continue;
    }

    if (!value) {
      cookieJar.delete(name);
      continue;
    }

    cookieJar.set(name, value);
  }
}

function getCookieHeader() {
  if (cookieJar.size === 0) {
    return "";
  }

  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function request(pathname, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (init.body && !("Content-Type" in headers)) {
    headers["Content-Type"] = "application/json";
  }

  const cookieHeader = getCookieHeader();
  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }

  const response = await fetch(`${FRONTEND_BASE_URL}${pathname}`, {
    redirect: "manual",
    ...init,
    headers
  });

  storeResponseCookies(response.headers);

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

function collectRoadmapTopics(roadmapPayload) {
  const stages = Array.isArray(roadmapPayload?.stages) ? roadmapPayload.stages : [];
  return stages.flatMap((stage) => (Array.isArray(stage?.topics) ? stage.topics : []));
}

function findRoadmapTopic(roadmapPayload, topicId) {
  return collectRoadmapTopics(roadmapPayload).find((topic) => topic?.id === topicId) ?? null;
}

function readId(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const topLevelId = payload.id;
  if (typeof topLevelId === "string" && topLevelId.trim().length > 0) {
    return topLevelId;
  }

  const topicId = payload.topicId;
  if (typeof topicId === "string" && topicId.trim().length > 0) {
    return topicId;
  }

  const nestedTopicId = payload.topic?.id ?? payload.data?.id;
  if (typeof nestedTopicId === "string" && nestedTopicId.trim().length > 0) {
    return nestedTopicId;
  }

  return null;
}

async function createTask({ title, description, topicId, deadline }) {
  const response = await request("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      title,
      description,
      topicId,
      deadline
    })
  });
  invariant(response.status === 201, `Task create expected 201, got ${response.status}`);
  const taskId = readId(response.body);
  invariant(typeof taskId === "string", "Expected created task id.");
  return {
    id: taskId,
    payload: response.body
  };
}

async function createTopic({ title, description }) {
  const response = await request("/api/roadmap/topics", {
    method: "POST",
    body: JSON.stringify({
      title,
      description
    })
  });
  invariant(response.status === 201, `Topic create expected 201, got ${response.status}`);
  const topicId = readId(response.body);
  invariant(typeof topicId === "string", "Expected created topic id.");
  return {
    id: topicId,
    payload: response.body
  };
}

async function registerAndAuthenticate() {
  const registerResponse = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      full_name: SMOKE_AUTH_FULL_NAME,
      email: SMOKE_AUTH_EMAIL,
      password: SMOKE_AUTH_PASSWORD
    })
  });

  if (registerResponse.status !== 200) {
    const loginResponse = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: SMOKE_AUTH_EMAIL,
        password: SMOKE_AUTH_PASSWORD
      })
    });
    invariant(
      loginResponse.status === 200,
      `Expected 200 from /api/auth/login fallback, got ${loginResponse.status}`
    );
  }

  const sessionResponse = await request("/api/auth/session");
  invariant(sessionResponse.status === 200, `Expected 200 from /api/auth/session, got ${sessionResponse.status}`);
  invariant(sessionResponse.body?.authenticated === true, "Expected authenticated session payload.");
  invariant(cookieJar.has("improve_access_token"), "Expected improve_access_token cookie.");
  invariant(cookieJar.has("improve_refresh_token"), "Expected improve_refresh_token cookie.");
}

async function run() {
  const checks = [];
  const state = {
    seedTopicId: null,
    seedTaskId: null
  };

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

  await check("Auth guard redirects unauthenticated private route", async () => {
    clearCookies();
    const response = await request("/dashboard");
    invariant(response.status === 307 || response.status === 308, `Expected 307/308, got ${response.status}`);
    const location = response.headers.get("location") ?? "";
    invariant(location.includes("/login"), `Expected redirect to /login, got "${location}"`);
  });

  await check("Auth endpoint validates payload", async () => {
    clearCookies();
    const response = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({})
    });
    invariant(response.status === 400, `Expected 400, got ${response.status}`);
    invariant(typeof response.body?.message === "string", "Expected JSON validation error message.");
  });

  await check("Auth register/login establishes session for protected BFF routes", async () => {
    clearCookies();
    await registerAndAuthenticate();

    const roadmap = await request("/api/roadmap");
    invariant(roadmap.status === 200, `Expected 200 from protected route after auth, got ${roadmap.status}`);
  });

  await check("Roadmap GET route keeps empty fallback for new account", async () => {
    const response = await request("/api/roadmap");
    invariant(response.status === 200, `Expected 200, got ${response.status}`);
    invariant(Array.isArray(response.body?.stages), "Expected stages array.");
    invariant(response.body.stages.length === 0, "Expected empty stages before first roadmap topic.");
  });

  await check("Roadmap quick-create route creates first topic on empty roadmap", async () => {
    const topicTitle = `Smoke quick topic ${SMOKE_RUN_ID}`;
    const create = await request("/api/roadmap/quick-create", {
      method: "POST",
      body: JSON.stringify({
        topicTitle,
        topicDescription: "Created by smoke verification."
      })
    });
    invariant(create.status === 201, `Quick-create expected 201, got ${create.status}`);
    const createdTopicId = readId(create.body);
    invariant(typeof createdTopicId === "string", "Expected created topic id.");
    state.seedTopicId = createdTopicId;

    const roadmap = await request("/api/roadmap");
    invariant(roadmap.status === 200, `Roadmap expected 200 after quick-create, got ${roadmap.status}`);
    invariant(Array.isArray(roadmap.body?.stages), "Expected roadmap stages array.");
    const createdTopic = findRoadmapTopic(roadmap.body, createdTopicId);
    invariant(Boolean(createdTopic), "Expected quick-created topic in roadmap response.");
    invariant(createdTopic.title === topicTitle, "Expected quick-created topic title in roadmap response.");
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

  await check("Topics GET route keeps success and fallback payload shapes", async () => {
    invariant(typeof state.seedTopicId === "string", "Expected seed topic id.");

    const success = await request(`/api/topics/${encodeURIComponent(state.seedTopicId)}`);
    invariant(success.status === 200, `Expected 200, got ${success.status}`);
    invariant(success.body?.id === state.seedTopicId, "Expected requested topic id.");
    invariant(typeof success.body?.title === "string", "Expected topic title.");
    invariant(Array.isArray(success.body?.checklist), "Expected checklist array.");
    invariant(Array.isArray(success.body?.materials), "Expected materials array.");
    invariant(Array.isArray(success.body?.dependencies), "Expected dependencies array.");

    const missingTopicId = randomUUID();
    const fallback = await request(`/api/topics/${encodeURIComponent(missingTopicId)}`);
    invariant(fallback.status === 200, `Expected 200 fallback, got ${fallback.status}`);
    invariant(fallback.body?.id === missingTopicId, "Expected fallback payload with requested topic id.");
    invariant(Array.isArray(fallback.body?.checklist), "Expected fallback checklist array.");
    invariant(Array.isArray(fallback.body?.materials), "Expected fallback materials array.");
    invariant(fallback.body.checklist.length === 0, "Expected empty checklist for missing topic.");
  });

  await check("Topics checklist PATCH route keeps success and key error statuses", async () => {
    invariant(typeof state.seedTopicId === "string", "Expected seed topic id.");

    const seedTask = await createTask({
      title: `Smoke seed task ${SMOKE_RUN_ID}`,
      description: "Created for checklist status checks.",
      topicId: state.seedTopicId,
      deadline: getDateString(3)
    });
    state.seedTaskId = seedTask.id;

    const success = await request(
      `/api/topics/${encodeURIComponent(state.seedTopicId)}/checklist/${encodeURIComponent(seedTask.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "in_progress" })
      }
    );
    invariant(success.status === 200, `Expected 200, got ${success.status}`);
    invariant(success.body?.success === true, "Expected success=true payload.");

    const invalidStatus = await request(
      `/api/topics/${encodeURIComponent(state.seedTopicId)}/checklist/${encodeURIComponent(seedTask.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" })
      }
    );
    invariant(invalidStatus.status === 422, `Expected 422, got ${invalidStatus.status}`);

    const invalidJson = await request(
      `/api/topics/${encodeURIComponent(state.seedTopicId)}/checklist/${encodeURIComponent(seedTask.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{invalid-json}"
      }
    );
    invariant(invalidJson.status === 400, `Expected 400, got ${invalidJson.status}`);

    const missing = await request(
      `/api/topics/${encodeURIComponent(state.seedTopicId)}/checklist/${encodeURIComponent(randomUUID())}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "todo" })
      }
    );
    invariant(missing.status === 404, `Expected 404, got ${missing.status}`);
  });

  await check("Tasks GET route keeps response shape", async () => {
    const response = await request("/api/tasks?due=all");
    invariant(response.status === 200, `Expected 200, got ${response.status}`);
    invariant(Array.isArray(response.body?.tasks), "Expected tasks array.");
    invariant(Array.isArray(response.body?.topics), "Expected topics array.");
    invariant(response.body.tasks.length > 0, "Expected non-empty tasks list.");

    if (state.seedTaskId) {
      const hasSeedTask = response.body.tasks.some((task) => task.id === state.seedTaskId);
      invariant(hasSeedTask, "Expected previously created seed task in board response.");
    }
  });

  await check("Tasks POST route keeps success and validation errors", async () => {
    const create = await request("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: `Smoke task ${SMOKE_RUN_ID}`,
        description: "Created by verification.",
        deadline: getDateString(5)
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
    const createdTask = await createTask({
      title: `Smoke status task ${SMOKE_RUN_ID}`,
      description: "Created for status transition check.",
      topicId: state.seedTopicId,
      deadline: getDateString(7)
    });
    const taskId = createdTask.id;

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

    const missing = await request(`/api/tasks/${encodeURIComponent(randomUUID())}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "paused" })
    });
    invariant(missing.status === 404, `Missing task expected 404, got ${missing.status}`);
  });

  await check("Tasks DELETE route keeps success and removes task from board response", async () => {
    const createdTask = await createTask({
      title: `Smoke delete task ${SMOKE_RUN_ID}`,
      description: "Created and deleted by verification.",
      topicId: state.seedTopicId,
      deadline: getDateString(2)
    });
    const taskId = createdTask.id;

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

  await check("Tasks DELETE route keeps key not-found status", async () => {
    const missingDelete = await request(`/api/tasks/${encodeURIComponent(randomUUID())}`, {
      method: "DELETE"
    });
    invariant(missingDelete.status === 404, `Missing task delete expected 404, got ${missingDelete.status}`);
  });

  await check("Materials GET/POST keep response shape and validation errors", async () => {
    const list = await request("/api/materials");
    invariant(list.status === 200, `Expected 200, got ${list.status}`);
    invariant(Array.isArray(list.body?.materials), "Expected materials array.");
    invariant(Array.isArray(list.body?.topics), "Expected topics array.");
    invariant(list.body.topics.length > 0, "Expected non-empty topics list.");

    const topicId = state.seedTopicId ?? list.body.topics[0].id;
    const create = await request("/api/materials", {
      method: "POST",
      body: JSON.stringify({
        title: `Smoke material ${SMOKE_RUN_ID}`,
        description: "Created by verification.",
        topicId,
        type: "video",
        totalAmount: 12,
        completedAmount: 3,
        position: 7
      })
    });
    invariant(create.status === 201, `Create expected 201, got ${create.status}`);
    invariant(typeof create.body?.id === "string", "Expected created material id.");
    invariant(create.body?.type === "video", "Expected created material type.");
    invariant(create.body?.unit === "hours", "Expected created material unit mapped from type.");
    invariant(create.body?.totalAmount === 12, "Expected created material totalAmount = 12.");
    invariant(create.body?.completedAmount === 3, "Expected created material completedAmount = 3.");

    const invalid = await request("/api/materials", {
      method: "POST",
      body: JSON.stringify({
        title: "Invalid material",
        description: "Invalid completed amount should fail",
        topicId,
        type: "book",
        totalAmount: 10,
        completedAmount: 11,
        position: 1
      })
    });
    invariant(invalid.status === 422, `Invalid payload expected 422, got ${invalid.status}`);
  });

  await check("Materials PATCH/DELETE keep success and key error statuses", async () => {
    const topicId = state.seedTopicId;
    invariant(typeof topicId === "string", "Expected seed topic id for material checks.");

    const created = await request("/api/materials", {
      method: "POST",
      body: JSON.stringify({
        title: `Patch-delete material ${SMOKE_RUN_ID}`,
        description: "Created for patch/delete checks.",
        topicId,
        type: "book",
        totalAmount: 100,
        completedAmount: 20,
        position: 8
      })
    });
    invariant(created.status === 201, `Create expected 201, got ${created.status}`);
    const materialId = readId(created.body);
    invariant(typeof materialId === "string", "Expected created material id.");

    const updated = await request(`/api/materials/${encodeURIComponent(materialId)}`, {
      method: "PATCH",
      body: JSON.stringify({ type: "course", totalAmount: 40, completedAmount: 14 })
    });
    invariant(updated.status === 200, `Patch expected 200, got ${updated.status}`);
    invariant(updated.body?.type === "course", "Expected updated type = course.");
    invariant(updated.body?.unit === "lessons", "Expected updated unit = lessons.");
    invariant(updated.body?.totalAmount === 40, "Expected updated totalAmount = 40.");
    invariant(updated.body?.completedAmount === 14, "Expected updated completedAmount = 14.");
    invariant(updated.body?.progressPercent === 35, "Expected updated progressPercent = 35.");

    const deleted = await request(`/api/materials/${encodeURIComponent(materialId)}`, {
      method: "DELETE"
    });
    invariant(deleted.status === 200, `Delete expected 200, got ${deleted.status}`);
    invariant(deleted.body?.success === true, "Expected delete success=true.");

    const missing = await request(`/api/materials/${encodeURIComponent(materialId)}`, {
      method: "PATCH",
      body: JSON.stringify({ totalAmount: 50, completedAmount: 25 })
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

  await check("Roadmap topic routes support stage-free create update delete flow", async () => {
    const createdTopic = await createTopic({
      title: `Smoke topic ${SMOKE_RUN_ID}`,
      description: "Created in smoke test."
    });
    const topicId = createdTopic.id;

    const topicUpdate = await request(`/api/roadmap/topics/${encodeURIComponent(topicId)}`, {
      method: "PUT",
      body: JSON.stringify({
        title: `Smoke topic updated ${SMOKE_RUN_ID}`,
        description: "Updated in smoke test."
      })
    });
    invariant(topicUpdate.status === 200, `Topic update expected 200, got ${topicUpdate.status}`);
    invariant(
      topicUpdate.body?.title === `Smoke topic updated ${SMOKE_RUN_ID}`,
      "Expected updated topic title."
    );

    const topicDelete = await request(`/api/roadmap/topics/${encodeURIComponent(topicId)}`, {
      method: "DELETE"
    });
    invariant(topicDelete.status === 200, `Topic delete expected 200, got ${topicDelete.status}`);
    invariant(topicDelete.body?.success === true, "Expected topic delete success=true.");
  });

  await check("Roadmap dependency routes support add, duplicate conflict and remove flow", async () => {
    const prerequisiteTopic = await createTopic({
      title: `Prerequisite topic ${SMOKE_RUN_ID}`,
      description: "Source dependency topic"
    });
    const prerequisiteTopicId = prerequisiteTopic.id;

    const dependentTopic = await createTopic({
      title: `Dependent topic ${SMOKE_RUN_ID}`,
      description: "Target dependency topic"
    });
    const dependentTopicId = dependentTopic.id;

    const dependencyAdd = await request(
      `/api/roadmap/topics/${encodeURIComponent(dependentTopicId)}/dependencies`,
      {
        method: "POST",
        body: JSON.stringify({
          prerequisiteTopicId
        })
      }
    );
    invariant(dependencyAdd.status === 201, `Dependency add expected 201, got ${dependencyAdd.status}`);
    invariant(dependencyAdd.body?.success === true, "Expected dependency add success=true.");

    const dependencyDuplicate = await request(
      `/api/roadmap/topics/${encodeURIComponent(dependentTopicId)}/dependencies`,
      {
        method: "POST",
        body: JSON.stringify({
          prerequisiteTopicId
        })
      }
    );
    invariant(
      dependencyDuplicate.status === 409,
      `Duplicate dependency expected 409, got ${dependencyDuplicate.status}`
    );

    const roadmapAfterAdd = await request("/api/roadmap");
    invariant(roadmapAfterAdd.status === 200, `Roadmap expected 200, got ${roadmapAfterAdd.status}`);
    const dependentTopicAfterAdd = findRoadmapTopic(roadmapAfterAdd.body, dependentTopicId);
    invariant(Boolean(dependentTopicAfterAdd), "Expected dependent topic in roadmap payload.");
    invariant(
      dependentTopicAfterAdd.prerequisiteTopicIds.includes(prerequisiteTopicId),
      "Expected dependency id in prerequisiteTopicIds after add."
    );

    const dependencyRemove = await request(
      `/api/roadmap/topics/${encodeURIComponent(dependentTopicId)}/dependencies/${encodeURIComponent(
        prerequisiteTopicId
      )}`,
      {
        method: "DELETE"
      }
    );
    invariant(dependencyRemove.status === 200, `Dependency remove expected 200, got ${dependencyRemove.status}`);
    invariant(dependencyRemove.body?.success === true, "Expected dependency remove success=true.");

    const roadmapAfterRemove = await request("/api/roadmap");
    invariant(roadmapAfterRemove.status === 200, `Roadmap expected 200, got ${roadmapAfterRemove.status}`);
    const dependentTopicAfterRemove = findRoadmapTopic(roadmapAfterRemove.body, dependentTopicId);
    invariant(Boolean(dependentTopicAfterRemove), "Expected dependent topic after dependency remove.");
    invariant(
      !dependentTopicAfterRemove.prerequisiteTopicIds.includes(prerequisiteTopicId),
      "Expected dependency id to be removed from prerequisiteTopicIds."
    );

    const dependentTopicDelete = await request(`/api/roadmap/topics/${encodeURIComponent(dependentTopicId)}`, {
      method: "DELETE"
    });
    invariant(dependentTopicDelete.status === 200, `Dependent topic cleanup expected 200, got ${dependentTopicDelete.status}`);

    const prerequisiteTopicDelete = await request(
      `/api/roadmap/topics/${encodeURIComponent(prerequisiteTopicId)}`,
      {
        method: "DELETE"
      }
    );
    invariant(
      prerequisiteTopicDelete.status === 200,
      `Prerequisite topic cleanup expected 200, got ${prerequisiteTopicDelete.status}`
    );
  });

  const failures = checks.filter((item) => item.status === "FAIL");

  console.log("Frontend MVP verification smoke");
  console.log(`Base URL: ${FRONTEND_BASE_URL}`);
  console.log("Backend: real backend via frontend BFF routes");
  console.log(`Run ID: ${SMOKE_RUN_ID}`);
  console.log(`Auth email: ${SMOKE_AUTH_EMAIL}`);
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
