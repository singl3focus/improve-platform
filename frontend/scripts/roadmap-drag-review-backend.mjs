import { createServer } from "node:http";

const PORT = Number(process.env.ROADMAP_REVIEW_BACKEND_PORT ?? "8081");
const HOST = process.env.ROADMAP_REVIEW_BACKEND_HOST ?? "127.0.0.1";

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
  return {
    roadmap: {
      id: "roadmap-review",
      title: "Roadmap review",
      stages: [
        {
          id: "stage-1",
          title: "Stage 1",
          position: 1,
          topics: [
            {
              id: "topic-a",
              stage_id: "stage-1",
              title: "Topic A",
              description: "Start topic",
              status: "in_progress",
              start_date: null,
              target_date: null,
              completed_date: null,
              is_blocked: false,
              block_reasons: [],
              dependencies: []
            },
            {
              id: "topic-b",
              stage_id: "stage-1",
              title: "Topic B",
              description: "Depends on A",
              status: "not_started",
              start_date: null,
              target_date: null,
              completed_date: null,
              is_blocked: false,
              block_reasons: [],
              dependencies: ["topic-a"]
            },
            {
              id: "topic-c",
              stage_id: "stage-1",
              title: "Topic C",
              description: "Depends on B",
              status: "not_started",
              start_date: null,
              target_date: null,
              completed_date: null,
              is_blocked: false,
              block_reasons: [],
              dependencies: ["topic-b"]
            }
          ]
        }
      ]
    },
    tasksByTopicId: {
      "topic-a": 1,
      "topic-b": 2,
      "topic-c": 1
    },
    materialsByTopicId: {
      "topic-a": 1,
      "topic-b": 1,
      "topic-c": 2
    }
  };
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

function hasDependencyPath(state, fromTopicId, targetTopicId, visited = new Set()) {
  if (fromTopicId === targetTopicId) {
    return true;
  }

  if (visited.has(fromTopicId)) {
    return false;
  }
  visited.add(fromTopicId);

  const fromTopic = findTopic(state, fromTopicId);
  if (!fromTopic || !Array.isArray(fromTopic.dependencies)) {
    return false;
  }

  for (const nextTopicId of fromTopic.dependencies) {
    if (nextTopicId === targetTopicId) {
      return true;
    }

    if (hasDependencyPath(state, nextTopicId, targetTopicId, visited)) {
      return true;
    }
  }

  return false;
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

  if (method === "POST" && path === "/api/v1/auth/refresh") {
    sendJson(response, 200, {
      access_token: "review-access-token",
      refresh_token: "review-refresh-token",
      user: {
        id: "review-user-1",
        email: "review@example.com",
        full_name: "Review User"
      }
    });
    return;
  }

  if (method === "GET" && path === "/api/v1/roadmap") {
    sendJson(response, 200, state.roadmap);
    return;
  }

  {
    const tasksMatch = path.match(/^\/api\/v1\/roadmap\/topics\/([^/]+)\/tasks$/);
    if (method === "GET" && tasksMatch) {
      const topicId = decodeURIComponent(tasksMatch[1]);
      if (!findTopic(state, topicId)) {
        sendJson(response, 404, { message: "Topic not found.", code: "topic_not_found" });
        return;
      }

      const total = state.tasksByTopicId[topicId] ?? 0;
      sendJson(response, 200, {
        topic_id: topicId,
        total,
        done: 0,
        percent: 0,
        tasks: []
      });
      return;
    }
  }

  {
    const materialsMatch = path.match(/^\/api\/v1\/roadmap\/topics\/([^/]+)\/materials$/);
    if (method === "GET" && materialsMatch) {
      const topicId = decodeURIComponent(materialsMatch[1]);
      if (!findTopic(state, topicId)) {
        sendJson(response, 404, { message: "Topic not found.", code: "topic_not_found" });
        return;
      }

      const count = state.materialsByTopicId[topicId] ?? 0;
      sendJson(
        response,
        200,
        Array.from({ length: count }).map((_, index) => ({
          id: `${topicId}-material-${index + 1}`,
          topic_id: topicId,
          title: `Material ${index + 1}`,
          description: "Review material",
          progress: 0,
          position: index + 1,
          updated_at: new Date().toISOString()
        }))
      );
      return;
    }
  }

  {
    const depAddMatch = path.match(/^\/api\/v1\/roadmap\/topics\/([^/]+)\/dependencies$/);
    if (method === "POST" && depAddMatch) {
      const topicId = decodeURIComponent(depAddMatch[1]);
      const topic = findTopic(state, topicId);
      if (!topic) {
        sendJson(response, 404, { message: "Topic not found.", code: "topic_not_found" });
        return;
      }

      const payload = await parseJsonBody(request);
      const dependencyTopicId =
        typeof payload?.depends_on_topic_id === "string" ? payload.depends_on_topic_id : "";
      const dependencyTopic = findTopic(state, dependencyTopicId);

      if (!dependencyTopic) {
        sendJson(response, 404, {
          message: "Dependency topic not found.",
          code: "dependency_topic_not_found"
        });
        return;
      }

      if (dependencyTopicId === topicId) {
        sendJson(response, 422, {
          message: "Topic cannot depend on itself.",
          code: "self_dependency"
        });
        return;
      }

      if (hasDependencyPath(state, dependencyTopicId, topicId)) {
        sendJson(response, 422, {
          message: "Dependency creates cycle.",
          code: "cycle_detected"
        });
        return;
      }

      if (!topic.dependencies.includes(dependencyTopicId)) {
        topic.dependencies.push(dependencyTopicId);
      }

      sendJson(response, 201, {
        success: true,
        topic_id: topicId,
        depends_on_topic_id: dependencyTopicId
      });
      return;
    }
  }

  {
    const depDeleteMatch =
      path.match(/^\/api\/v1\/roadmap\/topics\/([^/]+)\/dependencies\/([^/]+)$/);
    if (method === "DELETE" && depDeleteMatch) {
      const topicId = decodeURIComponent(depDeleteMatch[1]);
      const dependencyTopicId = decodeURIComponent(depDeleteMatch[2]);
      const topic = findTopic(state, topicId);
      if (!topic) {
        sendJson(response, 404, { message: "Topic not found.", code: "topic_not_found" });
        return;
      }

      topic.dependencies = topic.dependencies.filter((item) => item !== dependencyTopicId);
      sendJson(response, 200, { success: true });
      return;
    }
  }

  sendJson(response, 404, { message: "Route not found.", code: "route_not_found" });
});

server.listen(PORT, HOST, () => {
  console.log(`Roadmap drag review backend listening on http://${HOST}:${PORT}`);
});
