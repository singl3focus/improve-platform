import styles from "./page.module.css";

const dashboardMetrics = [
  { label: "Weekly momentum", value: "68%", tone: "blue" },
  { label: "Roadmap depth", value: "12 topics", tone: "moss" },
  { label: "Focus health", value: "3 active tracks", tone: "amber" }
] as const;

const todayTasks = [
  { title: "Refactor auth boundary", status: "Ready", emphasis: "blue" },
  { title: "Review roadmap structure", status: "In flow", emphasis: "moss" },
  { title: "Write learning reflection", status: "Warm-up", emphasis: "amber" }
] as const;

const roadmapStages = [
  {
    name: "Foundation",
    topics: [
      { title: "HTML semantics", status: "Done" },
      { title: "CSS systems", status: "Active" }
    ]
  },
  {
    name: "Systems",
    topics: [
      { title: "React architecture", status: "Queued" },
      { title: "State flows", status: "Queued" }
    ]
  },
  {
    name: "Mastery",
    topics: [
      { title: "Performance", status: "Locked" },
      { title: "Testing strategy", status: "Locked" }
    ]
  }
] as const;

const taskColumns = [
  {
    title: "Ready",
    tone: "blue",
    cards: ["Polish dashboard hierarchy", "Clarify weekly review prompt"]
  },
  {
    title: "In flow",
    tone: "moss",
    cards: ["Map roadmap states", "Tighten focus panel copy"]
  },
  {
    title: "Waiting",
    tone: "amber",
    cards: ["Validate material progress model"]
  }
] as const;

const materials = [
  { type: "Book", title: "Designing Data-Intensive Applications", progress: "68%" },
  { type: "Course", title: "Advanced Product Thinking", progress: "41%" },
  { type: "Article", title: "Linear interaction patterns", progress: "90%" }
] as const;

function Rail() {
  return (
    <aside className={styles.rail}>
      <div className={styles.railBrand}>
        <span className={styles.brandDot}>IP</span>
        <div>
          <p className={styles.eyebrow}>Improve Platform</p>
          <strong>Editorial Workspace</strong>
        </div>
      </div>

      <nav className={styles.nav}>
        <a className={`${styles.navItem} ${styles.navItemActive}`}>Today</a>
        <a className={styles.navItem}>Dashboard</a>
        <a className={styles.navItem}>Roadmap</a>
        <a className={styles.navItem}>Tasks</a>
        <a className={styles.navItem}>Materials</a>
      </nav>

      <div className={styles.railFooter}>
        <div className={styles.railPulse}>
          <span>Weekly pulse</span>
          <strong>On track</strong>
        </div>
        <button className={styles.railButton} type="button">
          Exit session
        </button>
      </div>
    </aside>
  );
}

function DashboardPreview() {
  return (
    <section className={styles.screenSection}>
      <div className={styles.sectionHeader}>
        <p className={styles.kicker}>01 Dashboard</p>
        <h2>Hierarchy first, analytics second</h2>
        <p>
          The dashboard stops treating every block like a white card. It becomes a ranked
          workspace: focus, momentum, roadmap, and operational queues.
        </p>
      </div>

      <div className={styles.frame}>
        <Rail />
        <div className={styles.canvas}>
          <div className={styles.appTopline}>
            <div>
              <p className={styles.eyebrow}>Monday review</p>
              <h3>Build depth without losing momentum.</h3>
            </div>
            <div className={styles.toplineBadge}>New direction</div>
          </div>

          <div className={styles.heroPanel}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Today&apos;s focus</p>
              <h4>One dominant action, one supporting lane, one honest reflection.</h4>
              <p>
                The page leads with a learning mission instead of a mosaic of equally weighted
                widgets.
              </p>
            </div>
            <div className={styles.metricRow}>
              {dashboardMetrics.map((metric) => (
                <article
                  key={metric.label}
                  className={`${styles.metricCard} ${styles[`tone${metric.tone}`]}`}
                >
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </article>
              ))}
            </div>
          </div>

          <div className={styles.dashboardGrid}>
            <section className={styles.activityPanel}>
              <div className={styles.panelHeading}>
                <div>
                  <p className={styles.eyebrow}>Activity</p>
                  <h5>Learning rhythm</h5>
                </div>
                <span>8 day streak</span>
              </div>
              <div className={styles.heatmap}>
                {Array.from({ length: 42 }, (_, index) => (
                  <span
                    key={index}
                    className={`${styles.heatCell} ${styles[`heat${index % 5}`]}`}
                  />
                ))}
              </div>
            </section>

            <section className={styles.sideStack}>
              <article className={styles.sidePanel}>
                <div className={styles.panelHeading}>
                  <div>
                    <p className={styles.eyebrow}>Roadmap pulse</p>
                    <h5>Next unlock</h5>
                  </div>
                  <span>Systems</span>
                </div>
                <div className={styles.sideCallout}>
                  <strong>React architecture</strong>
                  <p>Queued behind CSS systems and state flows.</p>
                </div>
              </article>

              <article className={styles.sidePanel}>
                <div className={styles.panelHeading}>
                  <div>
                    <p className={styles.eyebrow}>Queue</p>
                    <h5>Upcoming tasks</h5>
                  </div>
                  <span>4 items</span>
                </div>
                <ul className={styles.list}>
                  <li>Audit dashboard copy cadence</li>
                  <li>Wire weekly review states</li>
                  <li>Trim low-signal cards</li>
                </ul>
              </article>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

function TodayPreview() {
  return (
    <section className={styles.screenSection}>
      <div className={styles.sectionHeader}>
        <p className={styles.kicker}>02 Today</p>
        <h2>A daily page that feels like a ritual</h2>
        <p>
          Instead of sparse emptiness, the daily view becomes a focused sheet with one clear mission,
          supporting actions, and a compact reflection area.
        </p>
      </div>

      <div className={`${styles.frame} ${styles.frameFocused}`}>
        <div className={styles.todayCanvas}>
          <header className={styles.todayHeader}>
            <div>
              <p className={styles.eyebrow}>Sunday, March 29</p>
              <h3>Protect the next meaningful move.</h3>
            </div>
            <div className={styles.focusChip}>Focus Mode</div>
          </header>

          <div className={styles.todayHero}>
            <section className={styles.focusCard}>
              <p className={styles.kicker}>Primary task</p>
              <h4>Refactor the learning roadmap shell into a stronger narrative system.</h4>
              <p>
                Strip the visual clutter, define one hierarchy, and preserve operational clarity.
              </p>
              <div className={styles.focusMeta}>
                <span className={`${styles.signal} ${styles.toneblue}`}>Ready now</span>
                <span className={`${styles.signal} ${styles.tonemoss}`}>90 min block</span>
              </div>
            </section>

            <section className={styles.reflectCard}>
              <p className={styles.kicker}>Reflection</p>
              <blockquote>
                The interface should feel like a studio notebook, not a pile of floating widgets.
              </blockquote>
            </section>
          </div>

          <section className={styles.todayList}>
            {todayTasks.map((task) => (
              <article key={task.title} className={styles.todayItem}>
                <div className={styles.checkMarker} />
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.status}</p>
                </div>
                <span className={`${styles.signal} ${styles[`tone${task.emphasis}`]}`}>
                  {task.status}
                </span>
              </article>
            ))}
          </section>
        </div>
      </div>
    </section>
  );
}

function RoadmapPreview() {
  return (
    <section className={styles.screenSection}>
      <div className={styles.sectionHeader}>
        <p className={styles.kicker}>03 Roadmap</p>
        <h2>The signature screen becomes spatial and memorable</h2>
        <p>
          This version treats roadmap as the centerpiece of the product: stage bands, topic nodes,
          progress semantics, and a live inspector instead of generic empty cards.
        </p>
      </div>

      <div className={styles.frame}>
        <Rail />
        <div className={styles.canvas}>
          <div className={styles.appTopline}>
            <div>
              <p className={styles.eyebrow}>Roadmap</p>
              <h3>Frontend Systems Track</h3>
            </div>
            <div className={styles.toplineMeta}>12 topics / 3 stages</div>
          </div>

          <div className={styles.roadmapLayout}>
            <div className={styles.roadmapBands}>
              {roadmapStages.map((stage) => (
                <section key={stage.name} className={styles.stageBand}>
                  <div className={styles.stageHead}>
                    <p className={styles.eyebrow}>{stage.name}</p>
                    <span>{stage.topics.length} topics</span>
                  </div>
                  <div className={styles.topicRow}>
                    {stage.topics.map((topic) => (
                      <article key={topic.title} className={styles.topicNode}>
                        <span className={`${styles.topicStatus} ${styles[`status${topic.status.replace(/\s/g, "")}`]}`}>
                          {topic.status}
                        </span>
                        <strong>{topic.title}</strong>
                        <p>Progress mapped to real work, not just completion badges.</p>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <aside className={styles.inspector}>
              <p className={styles.kicker}>Inspector</p>
              <h4>CSS systems</h4>
              <p>
                Active topic with dependencies, target outcome, and a compact summary of tasks and
                materials.
              </p>
              <div className={styles.inspectorStats}>
                <span>5 tasks</span>
                <span>3 materials</span>
                <span>68% complete</span>
              </div>
              <div className={styles.progressTrack}>
                <span style={{ width: "68%" }} />
              </div>
              <div className={styles.sideCallout}>
                <strong>Next unlock</strong>
                <p>React architecture becomes available when CSS systems is marked complete.</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

function OperationsPreview() {
  return (
    <section className={styles.screenSection}>
      <div className={styles.sectionHeader}>
        <p className={styles.kicker}>04 Tasks + Materials</p>
        <h2>Operational pages get denser and calmer</h2>
        <p>
          The system stays consistent, but the work surfaces become more utilitarian: stronger
          column identity for tasks, search-first structure for materials, and less empty chrome.
        </p>
      </div>

      <div className={styles.operationsGrid}>
        <article className={styles.opsFrame}>
          <div className={styles.opsHeader}>
            <div>
              <p className={styles.eyebrow}>Tasks</p>
              <h3>Flow board</h3>
            </div>
            <div className={styles.opsButton}>Create task</div>
          </div>

          <div className={styles.kanban}>
            {taskColumns.map((column) => (
              <section key={column.title} className={styles.kanbanColumn}>
                <div className={styles.kanbanHead}>
                  <span className={`${styles.columnDot} ${styles[`tone${column.tone}`]}`} />
                  <strong>{column.title}</strong>
                </div>
                {column.cards.map((card) => (
                  <article key={card} className={styles.kanbanCard}>
                    <h4>{card}</h4>
                    <p>Sharper copy, clearer state, less decoration.</p>
                  </article>
                ))}
              </section>
            ))}
          </div>
        </article>

        <article className={styles.opsFrame}>
          <div className={styles.opsHeader}>
            <div>
              <p className={styles.eyebrow}>Materials</p>
              <h3>Knowledge library</h3>
            </div>
            <div className={styles.searchField}>Search materials</div>
          </div>

          <div className={styles.materialList}>
            {materials.map((material) => (
              <article key={material.title} className={styles.materialRow}>
                <div>
                  <span className={styles.materialType}>{material.type}</span>
                  <h4>{material.title}</h4>
                </div>
                <div className={styles.materialMeta}>
                  <strong>{material.progress}</strong>
                  <div className={styles.progressTrack}>
                    <span style={{ width: material.progress }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

export default function RedesignConceptPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Complete alternative direction</p>
          <h1>Replace the pastel dashboard with a sharper editorial workspace.</h1>
          <p className={styles.heroText}>
            This concept keeps the product model intact but rebuilds the visual system around
            stronger hierarchy, calmer density, and a more memorable roadmap-first identity.
          </p>
        </div>

        <div className={styles.approvalCard}>
          <p className={styles.eyebrow}>Approval focus</p>
          <ul className={styles.approvalList}>
            <li>Dark structural rail instead of soft white sidebar</li>
            <li>Warm ivory canvas instead of blue-pink pastel wash</li>
            <li>Fewer containers, clearer rank, denser operational views</li>
            <li>Roadmap becomes the signature surface of the product</li>
          </ul>
        </div>
      </section>

      <DashboardPreview />
      <TodayPreview />
      <RoadmapPreview />
      <OperationsPreview />
    </main>
  );
}
