# Improve Platform Redesign Implementation Roadmap

## Status
Approved as product direction draft.

## Core Direction
The product moves from a soft pastel/card-heavy interface to a more intentional editorial workspace.

Approved foundation:
- dark structural rail
- warm main canvas
- stronger typography and hierarchy
- fewer unnecessary containers
- denser and calmer operational screens
- clearer state colors and emphasis

What stays unchanged:
- core product model
- main route structure
- main entities and workflows
- roadmap content model

## Confirmed Decisions

### 1. Global Visual System
Keep the new editorial workspace direction.

This means:
- less visual softness
- less equal-weight card treatment
- more contrast between navigation, workspace, and support content
- stronger sense of product identity

### 2. Dashboard
Dashboard becomes a ranked workspace instead of a mosaic of similar cards.

Keep:
- focus block
- activity block
- queue block

Change:
- replace `roadmap pulse`

Chosen replacement:
- `Learning momentum`

Why:
- keeps dashboard strategic
- avoids repeating roadmap-specific context
- gives a better overview of weekly progress and rhythm

Suggested content for `Learning momentum`:
- weekly progress
- streak or active days
- completed tasks/materials this week
- short summary of current pace

### 3. Today
Today becomes a daily ritual surface, but without a single primary task.

Keep:
- reflective structure
- focused daily feeling
- compact, intentional layout

Change:
- user can add and manage as many tasks as needed
- no forced “one main task” model

Result:
- Today should feel like a personal daily workspace, not a one-mission screen

### 4. Tasks
Tasks remains an operational kanban screen.

Keep:
- all 4 existing columns
- existing task workflow model
- current board logic

Change only:
- visual hierarchy
- density
- toolbar and filter clarity
- calmer, stronger presentation of columns and cards

### 5. Materials
Materials stays a practical library/workspace screen.

Keep:
- current material model
- current search/filter/library logic

Change:
- stronger search-first layout
- cleaner presentation
- more mature and curated visual tone

### 6. Roadmap
Roadmap changes only in style, not in content model.

Keep:
- current roadmap meaning
- current structure and behavior
- current content blocks and interactions

Change:
- typography
- spacing
- state presentation
- surface styling
- visual hierarchy

Important:
- do not redesign roadmap into a new conceptual structure
- do not replace content with a new roadmap framework
- apply the new design language to the existing roadmap product model

## Implementation Phases

### Phase 1. Design System Foundation
Goal: establish the shared visual language before page-by-page rollout.

Scope:
- define new page shell
- define dark navigation rail
- define warm workspace canvas
- define typography scale
- define color roles for primary, progress, warning, muted, and neutral states
- define common surfaces, buttons, chips, list rows, and form treatments

Output:
- reusable app shell direction
- stable visual primitives for the rest of the rollout

### Phase 2. First Product Surfaces
Goal: implement the highest-visibility screens first.

Scope:
- `Dashboard`
- `Today`
- `Tasks`

Notes:
- Dashboard uses `Learning momentum` instead of `roadmap pulse`
- Today supports many tasks, not one primary task
- Tasks keeps all 4 existing columns

Why this phase comes first:
- these screens define the day-to-day feel of the product
- they validate the new system fastest
- they establish the operational tone of the redesign

### Phase 3. Library Surface
Goal: extend the same system to content management.

Scope:
- `Materials`

Focus:
- search-first hierarchy
- cleaner item presentation
- consistency with the new shell and operational UI language

### Phase 4. Roadmap Restyle
Goal: apply the new visual system to roadmap without changing roadmap meaning.

Scope:
- `Roadmap`

Rules:
- preserve existing roadmap content structure
- preserve current product logic
- update only visual language and hierarchy

This is intentionally last because:
- roadmap is sensitive
- style changes should land after the system is proven on other screens
- content-model drift must be avoided

## Recommended Execution Order
1. Build the shared shell and tokens.
2. Redesign `Dashboard`.
3. Redesign `Today`.
4. Redesign `Tasks`.
5. Redesign `Materials`.
6. Restyle `Roadmap` last.

## Acceptance Criteria
- The product clearly reads as an editorial workspace rather than a pastel dashboard.
- Navigation, content, and support areas no longer compete with equal weight.
- Dashboard has stronger ranking and uses `Learning momentum` instead of `roadmap pulse`.
- Today supports multiple tasks without a single-primary-task constraint.
- Tasks retains all 4 existing columns.
- Materials feels calmer and denser without losing utility.
- Roadmap adopts the new style without changing its content model.

## Next Working Step
Start with Phase 1 and prepare the shared app-shell redesign plus visual primitives required by Dashboard, Today, and Tasks.
