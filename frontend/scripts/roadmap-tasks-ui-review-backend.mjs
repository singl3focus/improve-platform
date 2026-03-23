import { createServer } from "node:http";

const PORT = Number(process.env.ROADMAP_TASKS_UI_REVIEW_BACKEND_PORT ?? "8087");
const HOST = process.env.ROADMAP_TASKS_UI_REVIEW_BACKEND_HOST ?? "127.0.0.1";
const TOPIC_STATUS_TRANSITIONS = {
  not_started: ["in_progress"],
  in_progress: ["paused", "completed"],
  paused: ["in_progress", "not_started"],
  completed: ["in_progress"]
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
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

function createState() {
  const state = {
    taskUpdateMode: "ok",
    roadmap: {
      id: "roadmap-ui-review",
      title: "UI review roadmap",
      stages: [
        {
          id: "stage-ui-foundations",
          title: "Foundations",
          position: 1,
          topics: [
            {
              id: "topic-html-css",
              stage_id: "stage-ui-foundations",
              title: "HTML & CSS",
              description: "Core markup and styling skills for UI verification.",
              position: 1,
              status: "in_progress",
              start_date: null,
              target_date: null,
              completed_date: null,
              is_blocked: false,
              block_reasons: [],
              dependencies: []
            },
            {
              id: "topic-javascript",
              stage_id: "stage-ui-foundations",
              title: "JavaScript basics",
              description: "Language fundamentals topic.",
              position: 2,
              status: "not_started",
              start_date: null,
              target_date: null,
              completed_date: null,
              is_blocked: false,
              block_reasons: [],
              dependencies: ["topic-html-css"]
            }
          ]
        }
      ]
    },
    tasks: [
      {
        id: "task-html-intro",
        topic_id: "topic-html-css",
        title: "Read HTML semantic tags guide",
        description: "Understand semantic page structure.",
        status: "new",
        deadline: "2030-01-10",
        position: 1,
        is_overdue: false
      },
      {
        id: "task-css-layout",
        topic_id: "topic-html-css",
        title: "Practice CSS Grid layout",
        description: "Build a sample board layout.",
        status: "in_progress",
        deadline: "2030-01-12",
        position: 2,
        is_overdue: false
      }
    ],
    materialsByTopicId: {
      "topic-html-css": [
        {
          id: "material-html-mdn",
          topic_id: "topic-html-css",
          title: "MDN HTML reference",
          description: "Reference docs.",
          type: "article",
          unit: "pages",
          total_amount: 100,
          completed_amount: 30,
          progress: 30,
          position: 1,
          updated_at: new Date().toISOString()
        }
      ],
      "topic-javascript": []
    }
  };

  refreshTopicBlockState(state);
  return state;
}

function findTopic(state, topicId) {
  for (const stage of state.roadmap.stages) {
    for (const topic of stage.topics) {
      if (topic.id === topicId) {
        return topic;
      }
    }
  }

  return null;
}

function getAllTopics(state) {
  return state.roadmap.stages.flatMap((stage) => stage.topics);
}

function refreshTopicBlockState(state) {
  const topicById = new Map(getAllTopics(state).map((topic) => [topic.id, topic]));

  for (const topic of getAllTopics(state)) {
    const blockReasons = (topic.dependencies ?? [])
      .map((dependencyId) => topicById.get(dependencyId))
      .filter(Boolean)
      .filter((dependencyTopic) => dependencyTopic.status !== "completed")
      .map((dependencyTopic) => `Prerequisite topic "${dependencyTopic.title}" is not completed.`);

    topic.is_blocked = blockReasons.length > 0;
    topic.block_reasons = blockReasons;
  }
}

const state = createState();

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
    if (payload?.taskUpdateMode === "ok" || payload?.taskUpdateMode === "error") {
      state.taskUpdateMode = payload.taskUpdateMode;
    }

    sendJson(response, 200, { taskUpdateMode: state.taskUpdateMode });
    return;
  }

  if (method === "POST" && path === "/api/v1/auth/refresh") {
    sendJson(response, 200, {
      access_token: "ui-review-access-token",
      refresh_token: "ui-review-refresh-token",
      user: {
        id: "ui-review-user",
        email: "ui-review@example.com",
        full_name: "UI Review"
      }
    });
    return;
  }

  if (method === "GET" && path === "/api/v1/roadmap") {
    refreshTopicBlockState(state);
    sendJson(response, 200, state.roadmap);
    return;
  }

  {
    const topicByIdMatch = path.match(/^\/api\/v1\/roadmap\/topics\/([^/]+)$/);
    if (topicByIdMatch) {
      const topicId = decodeURIComponent(topicByIdMatch[1]);
      const topic = findTopic(state, topicId);

      if (!topic) {
        sendJson(response, 404, { message: "Topic not found.", code: "topic_not_found" });
        return;
      }

      if (method === "GET") {
        refreshTopicBlockState(state);
        sendJson(response, 200, topic);
        return;
      }

      if (method === "PUT") {
        const payload = await parseJsonBody(request);

        topic.title =
          typeof payload?.title === "string" && payload.title.trim().length > 0
            ? payload.title.trim()
            : topic.title;
        topic.description =
          typeof payload?.description === "string" ? payload.description : topic.description;
        topic.position =
          typeof payload?.position === "number" && Number.isFinite(payload.position)
            ? payload.position
            : topic.position;
        topic.start_date =
          typeof payload?.start_date === "string" || payload?.start_date === null
            ? payload.start_date
            : topic.start_date;
        topic.target_date =
          typeof payload?.target_date === "string" || payload?.target_date === null
            ? payload.target_date
            : topic.target_date;

        refreshTopicBlockState(state);
        sendJson(response, 200, topic);
        return;
      }
    }
  }

  {
    const topicStatusMatch = path.match(/^\/api\/v1\/roadmap\/topics\/([^/]+)\/status$/);
    if (method === "PATCH" && topicStatusMatch) {
      const topicId = decodeURIComponent(topicStatusMatch[1]);
      const topic = findTopic(state, topicId);

      if (!topic) {
        sendJson(response, 404, { message: "Topic not found.", code: "topic_not_found" });
        return;
      }

      const payload = await parseJsonBody(request);
      const nextStatus = typeof payload?.status === "string" ? payload.status : "";
      if (!["not_started", "in_progress", "paused", "completed"].includes(nextStatus)) {
        sendJson(response, 400, {
          message: "Invalid topic status transition.",
          code: "invalid_status"
        });
        return;
      }

      const allowedTransitions = TOPIC_STATUS_TRANSITIONS[topic.status] ?? [];
      if (nextStatus !== topic.status && !allowedTransitions.includes(nextStatus)) {
        sendJson(response, 400, {
          message: "Invalid topic status transition.",
          code: "invalid_status"
        });
        return;
      }

      refreshTopicBlockState(state);
      if (
        topic.is_blocked &&
        nextStatus !== topic.status &&
        (nextStatus === "in_progress" || nextStatus === "completed")
      ) {
        sendJson(response, 409, {
          message: "Topic is blocked by incomplete prerequisites.",
          code: "topic_blocked"
        });
        return;
      }

      topic.status = nextStatus;
      if (nextStatus === "in_progress" && !topic.start_date) {
        topic.start_date = new Date().toISOString().slice(0, 10);
      }
      topic.completed_date =
        nextStatus === "completed" ? new Date().toISOString().slice(0, 10) : null;

      refreshTopicBlockState(state);
      sendJson(response, 200, topic);
      return;
    }
  }

  {
    const topicTasksMatch = path.match(/^\/api\/v1\/roadmap\/topics\/([^/]+)\/tasks$/);
    if (method === "GET" && topicTasksMatch) {
      const topicId = decodeURIComponent(topicTasksMatch[1]);
      if (!findTopic(state, topicId)) {
        sendJson(response, 404, { message: "Topic not found.", code: "topic_not_found" });
        return;
      }

      const topicTasks = state.tasks.filter((task) => task.topic_id === topicId);
      const done = topicTasks.filter((task) => task.status === "done").length;
      const total = topicTasks.length;
      const percent = total === 0 ? 0 : Math.round((done / total) * 100);

      sendJson(response, 200, {
        topic_id: topicId,
        total,
        done,
        percent,
        tasks: topicTasks
      });
      return;
    }
  }

  {
    const topicMaterialsMatch = path.match(/^\/api\/v1\/roadmap\/topics\/([^/]+)\/materials$/);
    if (method === "GET" && topicMaterialsMatch) {
      const topicId = decodeURIComponent(topicMaterialsMatch[1]);
      if (!findTopic(state, topicId)) {
        sendJson(response, 404, { message: "Topic not found.", code: "topic_not_found" });
        return;
      }

      sendJson(response, 200, state.materialsByTopicId[topicId] ?? []);
      return;
    }
  }

  if (method === "GET" && path === "/api/v1/tasks") {
    const topicId = url.searchParams.get("topic_id");
    const payload = topicId
      ? state.tasks.filter((task) => task.topic_id === topicId)
      : state.tasks.slice();
    sendJson(response, 200, payload);
    return;
  }

  {
    const taskByIdMatch = path.match(/^\/api\/v1\/tasks\/([^/]+)$/);
    if (taskByIdMatch) {
      const taskId = decodeURIComponent(taskByIdMatch[1]);
      const taskIndex = state.tasks.findIndex((task) => task.id === taskId);
      const task = taskIndex >= 0 ? state.tasks[taskIndex] : null;

      if (!task) {
        sendJson(response, 404, { message: "Task not found.", code: "task_not_found" });
        return;
      }

      if (method === "GET") {
        sendJson(response, 200, task);
        return;
      }

      if (method === "PUT") {
        if (state.taskUpdateMode === "error") {
          sendJson(response, 500, {
            message: "Task update failed in review mock backend.",
            code: "task_update_failed"
          });
          return;
        }

        const payload = await parseJsonBody(request);
        const deadline =
          typeof payload?.deadline === "string" && payload.deadline.trim().length > 0
            ? payload.deadline.trim()
            : null;

        const updatedTask = {
          ...task,
          title:
            typeof payload?.title === "string" && payload.title.trim().length > 0
              ? payload.title.trim()
              : task.title,
          description:
            typeof payload?.description === "string" ? payload.description : task.description,
          topic_id:
            typeof payload?.topic_id === "string" && payload.topic_id.trim().length > 0
              ? payload.topic_id.trim()
              : null,
          deadline,
          position:
            typeof payload?.position === "number" && Number.isFinite(payload.position)
              ? payload.position
              : task.position,
          is_overdue: false
        };

        state.tasks[taskIndex] = updatedTask;
        sendJson(response, 200, updatedTask);
        return;
      }

      if (method === "DELETE") {
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
      const task = state.tasks.find((item) => item.id === taskId);

      if (!task) {
        sendJson(response, 404, { message: "Task not found.", code: "task_not_found" });
        return;
      }

      const payload = await parseJsonBody(request);
      const nextStatus = typeof payload?.status === "string" ? payload.status : "";
      if (!["new", "in_progress", "paused", "done"].includes(nextStatus)) {
        sendJson(response, 422, { message: "Invalid status.", code: "validation_error" });
        return;
      }

      task.status = nextStatus;
      sendJson(response, 200, task);
      return;
    }
  }

  sendJson(response, 404, { message: "Route not found.", code: "route_not_found" });
});

server.listen(PORT, HOST, () => {
  console.log(`Roadmap/tasks UI review backend listening on http://${HOST}:${PORT}`);
});
