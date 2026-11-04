# ArchBoard — Product Architecture & Task Management Platform

Design spec. Source brief: `docs/requirements.md` (Vietnamese, verbatim from the owner). Reference diagram: `docs/phantom-r3-reference.png`.
Where this file and the brief differ, this file wins. Decisions marked **(call)** were made by the architect, not the owner — they are reasonable defaults, keep them unless they block you.

## 1. Intent

An internal tool for a hardware/software R&D team to see, per product, **how the system is put together** (a Draw.io-like architecture canvas) and **how far along it is** (features → tasks, with automatic progress and overdue detection). It replaces "a Draw.io file + a spreadsheet". It must be a working app with real persistence — no static or demo-only buttons. Every visible control must do something real.

Anti-goals: flashy UI (gradients, heavy animation), fake data hardcoded in components, buttons that do nothing, progress numbers that drift out of sync between screens.

## 2. Stack & repo layout

```
archboard/                 npm workspaces root
  backend/                 NestJS + Prisma + PostgreSQL, REST under /api
  frontend/                Next.js (App Router) + TS + Tailwind + shadcn/ui + @xyflow/react + Recharts + TanStack Query
  e2e/                     Playwright
  scripts/dev.mjs          one-command dev stack (embedded Postgres + backend + frontend)
  docker-compose.yml       production (postgres, backend, frontend)
  docker-compose.dev.yml   dev with a dockerised postgres (optional, for machines with Docker)
  docs/
```

- Use current **stable** releases (not rc/beta) of NestJS, Next.js, Prisma, React Flow, Recharts, Tailwind, shadcn. Exception: `embedded-postgres` only ships `-beta` tags; use `embedded-postgres@18.1.0-beta.16` (verified working on this Windows machine).
- **This dev machine has no Docker and no system PostgreSQL** (Windows 11, Node 24). Dev and tests use `embedded-postgres` (real PostgreSQL 18 binaries from npm). Docker files are still written for production but cannot be run here — keep them simple and conventional.
- Ports: frontend 3000, backend 4000, dev Postgres 5433. E2E stack: frontend 3100, backend 4100, Postgres 5434.
- The frontend calls the backend **same-origin** via Next.js rewrites: `/api/:path*` → `${BACKEND_URL}/api/:path*` (`BACKEND_URL` default `http://localhost:4000`). This keeps the auth cookie first-party and removes CORS.
- UI language: English chrome (the owner's menu is in English); data content is Vietnamese. All text must render Vietnamese diacritics correctly, including PDF export. **(call)**

## 3. Domain rules (the part that must be exactly right)

### 3.1 Dates
- `startDate` and `deadline` on products, features and tasks are **calendar dates** (`@db.Date`), exchanged as `"YYYY-MM-DD"` strings.
- "Today" is evaluated in `APP_TIMEZONE` (default `Asia/Ho_Chi_Minh`). Put this in one helper (`today()` returning `YYYY-MM-DD`) and use it everywhere; tests inject a fixed clock.

### 3.2 Task status and overdue
- Stored status: `TODO | IN_PROGRESS | REVIEW | COMPLETED`. **`OVERDUE` is never stored** — it is derived.
- `isOverdue = status !== COMPLETED && deadline !== null && deadline < today()`. A task due today is not overdue.
- `effectiveStatus = isOverdue ? 'OVERDUE' : status`. The API returns `status`, `effectiveStatus` and `isOverdue` on every task.
- Because it is derived, changing a deadline immediately changes overdue state, and an overdue task can still move to IN_PROGRESS / REVIEW / COMPLETED.
- On transition **to** COMPLETED: set `completedAt = now`, `completedLate = deadline !== null && today() > deadline`. `completedLate` is frozen at completion time — later deadline edits do not change it. **(call: prevents hiding lateness after the fact; the edit is in history anyway)**
- On transition **away from** COMPLETED: clear `completedAt`, set `completedLate = false`.
- Filtering by status `OVERDUE` means `isOverdue`. Filtering by `TODO`/`IN_PROGRESS`/`REVIEW` returns tasks with that stored status **that are not overdue** (so the five statuses partition the task set). Do this in SQL (Prisma `where`), not by post-filtering pages.

### 3.3 Progress
- Feature progress = `round(100 * completedTasks / totalTasks)`, 0 when no tasks.
- Product progress = same formula over **all tasks of the product** (task-weighted, not an average of features). **(call)**
- Node progress on the canvas = the referenced product's (or linked feature's) progress, read live — never stored.
- All counts/progress are computed by the backend from the database on each request. No cached counters. **(call: correctness over speed; data sizes are small)**
- `product.lastActivityAt` ("last updated" on cards) is bumped whenever the product, any of its features, tasks, checklist items, comments, attachments or its diagram change.

### 3.4 Status partition used in dashboards and reports
`todo`, `inProgress`, `review`, `completed`, `overdue` are disjoint and sum to `total` (an open overdue task counts only as `overdue`). "Task chưa thực hiện" = `todo`, "đang thực hiện" = `inProgress` (+ `review` shown separately).

### 3.5 On-time completion rate (reports)
`onTimeRate = completedOnTime / (completedWithDeadline + overdueOpen)` where `completedOnTime` = completed and not `completedLate` and has a deadline. `null` when the denominator is 0. **(call)**

## 4. Auth & permissions

- Email + password. Passwords hashed with `bcryptjs`. JWT (7 days) in an **httpOnly, SameSite=Lax cookie** `ab_token` (`Secure` in production). `JWT_SECRET` from env; refuse to start in production without it.
- No public sign-up (internal tool): admins create users. Users are deactivated, never hard-deleted (they are referenced by history/comments). Deactivated users cannot log in.
- Login rate-limited (e.g. 10/min/IP via `@nestjs/throttler`).
- Roles **(call)**:
  - `ADMIN`: everything, including user management.
  - `MANAGER`: full CRUD on products, features, tasks, diagrams. No user management.
  - `MEMBER`: read everything. Create tasks. Edit/delete tasks they **created**. On tasks **assigned** to them: change status, edit checklist. Comment on any task (edit/delete own comments). Upload attachments to tasks they created or are assigned to. Cannot create/edit/delete products, features, or diagrams.
- Enforce in the backend (guards + service checks). The frontend hides/disables controls the user cannot use, but the backend is the authority. 401 for unauthenticated, 403 for forbidden.

## 5. Data model

See `backend/prisma/schema.prisma` (written by the architect — treat it as the contract; you may add indexes or adjust the generator/datasource block to the installed Prisma version, but do not change model semantics without noting why in your report).

Key points:
- Product → Features → Tasks (cascade delete). Product → ArchitectureNodes → ArchitectureConnections (cascade).
- `ArchitectureNode.productId` = the diagram it belongs to. A `PRODUCT` node references another product via `refProductId` (cascade: deleting a product removes its nodes from every diagram). A `MODULE` node may link to a feature of the diagram's product (`featureId`, set null on delete). A `NOTE` node is a free text annotation (like the box in the reference image).
- A product appears at most once per diagram (`@@unique([productId, refProductId])`). Exactly zero or one `isCenter` node per diagram.
- Product names unique; feature names unique within a product ("không trùng lặp").
- Product-node labels are **not** stored independently: a PRODUCT node always displays the referenced product's current name. "Rename" on a product node renames the product. **(call: single source of truth)**

## 6. REST API contract

Global prefix `/api`. JSON. Dates `YYYY-MM-DD`, timestamps ISO-8601.
Errors: `{ "statusCode": 400, "message": "Validation failed", "errors": [{ "field": "title", "message": "title should not be empty" }] }`. 404 for missing resources, 409 for unique conflicts and stale diagram saves. Never leak stack traces or Prisma error text.
Validation: global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` with class-validator DTOs.

Shared shapes:
```ts
UserRef      = { id, name, email, avatarColor }
User         = UserRef & { role: 'ADMIN'|'MANAGER'|'MEMBER', isActive, createdAt }
ProductRef   = { id, name, icon, color }
Counts       = { taskCount, completedCount, overdueCount, progress }   // progress 0..100 int
ProductSummary = ProductRef & Counts & {
  description, status: 'PLANNING'|'ACTIVE'|'ON_HOLD'|'COMPLETED'|'ARCHIVED',
  owner: UserRef|null, startDate, deadline, featureCount, lastActivityAt, createdAt }
FeatureSummary = Counts & { id, productId, name, description, category, owner: UserRef|null,
  startDate, deadline, sortOrder, createdAt, updatedAt }
Task = { id, title, description, status, effectiveStatus, isOverdue, priority: 'LOW'|'MEDIUM'|'HIGH'|'URGENT',
  startDate, deadline, completedAt, completedLate, sortOrder, createdAt, updatedAt,
  feature: { id, name, category }, product: ProductRef,
  assignee: UserRef|null, creator: UserRef,
  checklist: { done, total }, commentCount, attachmentCount }
TaskDetail = Task & { checklistItems: ChecklistItem[] }
ChecklistItem = { id, title, done, sortOrder }
Comment    = { id, body, author: UserRef, createdAt, updatedAt }
Attachment = { id, fileName, mimeType, size, uploader: UserRef, createdAt }
HistoryEntry = { id, action, field, oldValue, newValue, actor: UserRef, createdAt }
Notification = { id, type, title, body, taskId, productId, readAt, createdAt }
```

| Method & path | Who | Notes |
|---|---|---|
| `GET /api/health` | public | `{ ok: true }` |
| `POST /api/auth/login` | public | `{ email, password }` → sets cookie, returns `User` |
| `POST /api/auth/logout` | any | clears cookie |
| `GET /api/auth/me` | any | `User` |
| `PATCH /api/auth/me` | any | `{ name?, avatarColor? }` |
| `POST /api/auth/change-password` | any | `{ currentPassword, newPassword }` (min 8) |
| `GET /api/users` | any | `User[]` (for assignee pickers; `?active=true`) |
| `POST /api/users` | admin | `{ email, name, role, password }` |
| `PATCH /api/users/:id` | admin | `{ name?, role?, isActive?, password? }` (admin cannot deactivate/demote themselves) |
| `GET /api/products` | any | `?search=&status=&sort=progress\|updated\|name\|created&order=asc\|desc` → `ProductSummary[]` |
| `POST /api/products` | mgr+ | `{ name, description?, icon?, color?, status?, ownerId?, startDate?, deadline? }` |
| `GET /api/products/:id` | any | `ProductSummary` |
| `PATCH /api/products/:id` | mgr+ | partial of POST |
| `DELETE /api/products/:id` | mgr+ | cascades features/tasks/nodes |
| `GET /api/products/:id/features` | any | `FeatureSummary[]` ordered by category, sortOrder, name |
| `POST /api/products/:id/features` | mgr+ | `{ name, description?, category?, ownerId?, startDate?, deadline? }` |
| `GET /api/features/:id` | any | `FeatureSummary & { product: ProductRef }` |
| `PATCH /api/features/:id` | mgr+ | partial (+ `sortOrder`) |
| `DELETE /api/features/:id` | mgr+ | cascades tasks; client must warn with `taskCount` first |
| `GET /api/tasks` | any | filters below → `{ items: Task[], total }` |
| `POST /api/tasks` | any | `{ featureId, title, description?, assigneeId?, startDate?, deadline?, priority?, status? }`; creator = caller |
| `GET /api/tasks/:id` | any | `TaskDetail` |
| `PATCH /api/tasks/:id` | per §4 | partial: `title, description, assigneeId (null to unassign), startDate, deadline, priority, status, sortOrder, featureId (same product only)` |
| `DELETE /api/tasks/:id` | per §4 | |
| `POST /api/tasks/:id/checklist` | per §4 | `{ title }` → `ChecklistItem` |
| `PATCH /api/checklist/:itemId` | per §4 | `{ title?, done?, sortOrder? }` |
| `DELETE /api/checklist/:itemId` | per §4 | |
| `GET /api/tasks/:id/comments` | any | `Comment[]` oldest first |
| `POST /api/tasks/:id/comments` | any | `{ body }` (1..5000 chars) |
| `PATCH /api/comments/:id` | author | `{ body }` |
| `DELETE /api/comments/:id` | author/admin | |
| `GET /api/tasks/:id/attachments` | any | `Attachment[]` |
| `POST /api/tasks/:id/attachments` | per §4 | multipart field `file`, max 10 MB; stored under `UPLOAD_DIR` with a random key, original name kept in DB |
| `GET /api/attachments/:id/download` | any | streams file with `Content-Disposition: attachment` |
| `DELETE /api/attachments/:id` | uploader/mgr+ | removes file and row |
| `GET /api/tasks/:id/history` | any | `HistoryEntry[]` newest first |
| `GET /api/products/:id/architecture` | any | see §6.2 |
| `PUT /api/products/:id/architecture` | mgr+ | see §6.2 |
| `GET /api/dashboard` | any | see §6.3 |
| `GET /api/reports` | any | see §6.4 |
| `GET /api/reports/export` | any | same filters + `format=xlsx\|pdf` → file download |
| `GET /api/notifications` | any | `?unread=true` → `{ items: Notification[], unreadCount }` (latest 50) |
| `PATCH /api/notifications/:id/read` | owner | |
| `POST /api/notifications/read-all` | any | |

### 6.1 `GET /api/tasks` filters
`productId, featureId, assigneeId (uuid or "me"), creatorId, status (comma list of TODO,IN_PROGRESS,REVIEW,COMPLETED,OVERDUE — see §3.2), priority (comma list), overdue=true, from, to (deadline range, inclusive), search (title ILIKE), sort=deadline|priority|createdAt|updatedAt|title|sortOrder, order, page (1-based), pageSize (default 50, max 500)`.

### 6.2 Architecture
`GET` returns:
```ts
{ productId, updatedAt: string|null,
  nodes: [{ id, kind: 'PRODUCT'|'MODULE'|'NOTE', label, refProductId, featureId,
            refProduct: (ProductRef & { status, progress, taskCount, overdueCount }) | null,
            feature: ({ id, name, progress }) | null,
            position: { x, y }, width, height, isCenter, color }],
  connections: [{ id, sourceNodeId, targetNodeId, sourceHandle, targetHandle, label, direction: 'FORWARD'|'BACKWARD'|'BOTH'|'NONE' }] }
```
If the product has never saved a diagram, return a single unsaved center PRODUCT node for the product itself (id generated server-side, `updatedAt: null`).
For PRODUCT nodes `label` is the referenced product's name (see §5).

`PUT` body: `{ baseUpdatedAt: string|null, nodes: [...same minus refProduct/feature], connections: [...] }`. Node and connection ids are client-generated UUIDs. Replaces the whole diagram in one transaction. Validates: refProductIds exist; featureIds belong to this product; every connection references a node in the payload; no self-loops; ≤1 center; no duplicate refProductId. If `baseUpdatedAt` doesn't match the stored `architectureUpdatedAt` → 409 (someone else saved). Returns the same shape as `GET`.

### 6.3 Dashboard
```ts
{ totals: { products, features, tasks, todo, inProgress, review, completed, overdue },
  statusDistribution: [{ status: 'TODO'|'IN_PROGRESS'|'REVIEW'|'COMPLETED'|'OVERDUE', count }],
  completionTrend: [{ weekStart: 'YYYY-MM-DD', created, completed, completedLate }],   // last 12 ISO weeks
  productProgress: [{ productId, name, color, progress, taskCount, overdueCount }],
  products: ProductSummary[] }   // for the cards, sorted by lastActivityAt desc
```

### 6.4 Reports
Query: `productId?, from?, to?, granularity=week|month`. **(call)** Range semantics: summary/features/products/workload count tasks whose `deadline` falls in `[from,to]` (no range → all tasks); `throughput` buckets tasks by `completedAt` within the range (default last 12 weeks / 12 months).
```ts
{ range: { from, to }, summary: { total, completed, open, overdue, completedLate, completedOnTime, onTimeRate },
  throughput: [{ period, completed, completedLate }],
  products: [{ productId, name, total, completed, overdue, progress }],
  features: [{ featureId, name, category, productId, productName, total, completed, overdue, progress }],
  workload: [{ userId, name, total, open, completed, overdue, completedLate }] }   // by assignee; "Unassigned" row with userId null
```
Export: `xlsx` (exceljs: one sheet per section) and `pdf` (pdfkit, with a bundled TTF font that has Vietnamese glyphs, e.g. Noto Sans or Be Vietnam Pro — check the font licence is OFL). Filename `archboard-report-YYYY-MM-DD.(xlsx|pdf)`.

### 6.5 History & notifications
- Write a `task_history` row for: create, each changed field on update (`field`, `oldValue`, `newValue` as display strings — e.g. assignee name, not id), status change, checklist add/toggle/remove, comment added, attachment added/removed. Same transaction as the change.
- Notifications (never notify the actor about their own action):
  - `TASK_ASSIGNED` → new assignee.
  - `TASK_COMMENTED` → assignee and creator.
  - `TASK_STATUS_CHANGED` → creator (and assignee if different from actor).
  - `TASK_OVERDUE` → assignee (or creator if unassigned), once per task: a job (`@nestjs/schedule`, hourly + on startup) finds overdue tasks with `overdueNotifiedAt = null`, notifies, sets `overdueNotifiedAt`. Changing the deadline resets `overdueNotifiedAt` to null.

## 7. Frontend

### 7.1 Look & feel
Linear/Notion density on a white / `zinc-50` background; 1px `zinc-200` borders over shadows; Inter (via `next/font`); 13–14px body; one accent (`#2563eb`). Status colours: Todo zinc, In Progress blue, Review amber, Completed green, Overdue red. Priority: Low zinc, Medium blue, High orange, Urgent red. No gradients, transitions ≤150ms, no decorative animation. Desktop first; tablet (≥768px) must remain usable (sidebar auto-collapses, tables scroll horizontally). Use shadcn/ui components (Button, Dialog, AlertDialog, Sheet, DropdownMenu, ContextMenu, Select, Tabs, Input, Textarea, Badge, Tooltip, Popover, Command, Checkbox, Avatar, Progress, Table, Sonner toasts…). Dates via native `<input type="date">`. Icons: lucide-react (products store a lucide icon name + hex colour as their "logo").

### 7.2 Data layer
TanStack Query. Every mutation invalidates the affected keys **and** `['dashboard']`, `['products']`, `['reports']`, so progress/counters on every screen re-sync immediately (UX rule: adding/completing a task updates the overview instantly). Typed API client in one module, types mirroring §6. 401 → redirect to `/login?next=…`. Errors → toast with the server message; form field errors shown inline from `errors[]`.

### 7.3 Routes & screens
- `/login`.
- Layout: collapsible left sidebar (state persisted in localStorage) with Dashboard, Products, Architecture, My Tasks, All Tasks, Overdue Tasks (with live count badge), Reports, Settings; top bar with breadcrumb, global search (products + tasks via the API, ⌘K), notification bell (unread count, dropdown list, mark read, click opens the task), user menu (logout).
- `/dashboard`: 8 stat tiles (§6.3 totals), charts (completion trend line/bar, product progress bar, status distribution donut, overdue by product bar), product cards (icon, name, short description, featureCount, taskCount, progress bar + %, overdueCount, last updated) → click opens `/products/[id]`.
- `/products`: card grid or table toggle; search, status filter, sort (progress / updated / name); create & edit dialog; delete with AlertDialog that states how many features/tasks will be deleted.
- `/products/[id]`: header (icon, name, description, owner, start, deadline, status, progress) with edit; tabs:
  - **Features** — grouped by category (Hardware, Firmware, Backend, Frontend… free text with suggestions from existing categories); each row shows owner, deadline, progress bar, task counts, overdue count. CRUD dialogs; delete warns with the task count. Clicking a feature opens the Tasks tab filtered to that feature (`?tab=tasks&feature=<id>`).
  - **Tasks** — view switcher List / Kanban / Timeline / Calendar; filter bar (assignee, feature, status incl. Overdue, priority, deadline range, overdue-only); all filter + view state in the URL so refresh keeps it.
    - List: table, sortable columns, inline status change.
    - Kanban: columns Todo / In Progress / Review / Completed (drag between columns changes status, order persisted via `sortOrder`; @dnd-kit). Overdue tasks stay in their stored-status column with a red "Overdue" badge, plus a toggle to show an Overdue swim-lane on top. **(call: you can't "drag into overdue")**
    - Timeline: Gantt bars from startDate (or createdAt) to deadline, grouped by feature, day/week zoom, today line, overdue bars red, completed-late marked. Built in-house (CSS grid) — no extra Gantt dependency.
    - Calendar: month grid, tasks on their deadline date, prev/next/today, overdue red; click opens the task.
  - **Architecture** — embedded read-only preview of the canvas + "Open editor" → `/architecture/[id]`.
  - Overview strip at top of tab area: overdue tasks of this product (always visible if any).
- Task detail: a right-side Sheet opened by `?task=<id>` on any page (shareable, survives refresh): title/description inline edit, status, priority, assignee, start, deadline, feature, creator, created/updated; checklist (add, toggle, rename, delete, progress); attachments (upload, download, delete); comments (add, edit, delete own); history timeline. Completed-late tasks show a "Completed late" badge.
- `/tasks/my`, `/tasks`, `/tasks/overdue`: cross-product task list (List + Kanban), same filter bar plus product filter; "New task" dialog picks product → feature.
- `/architecture`: grid of products (with node count / last diagram save) → `/architecture/[productId]`.
- `/architecture/[productId]`: full-height canvas editor, §7.4.
- `/reports`: filters (product, from/to, granularity), summary tiles, throughput chart, product & feature progress tables, workload table/chart; Export Excel / Export PDF buttons hit the export endpoint.
- `/settings`: Profile (name, avatar colour), Change password, Users (admin only: list, create, edit role, deactivate, reset password).

### 7.4 Architecture canvas (most important feature)
React Flow (`@xyflow/react`), dotted background, minimap, snap to 10px grid, infinite pan/zoom (0.1–2).
- **Node types**: `product` (refProduct icon, name, status badge, progress bar + %, overdue count; the `isCenter` node is ~1.6× larger), `module` (rounded rectangle with label, like the reference image; shows linked feature progress if `featureId`), `note` (bordered text box, multi-line, for annotations like the reference image's protocol note). Each node has 4 connection handles (top/right/bottom/left).
- **Edges**: orthogonal (`smoothstep`) like Draw.io, optional label (e.g. "Wav", "all định dạng"), arrowheads per `direction` (FORWARD, BACKWARD, BOTH, NONE). Double-click an edge to edit its label; context menu to change direction or delete.
- **Toolbar** (top, Draw.io style, with tooltips + shortcuts): Select (V) · Hand/Pan (H, also Space-drag) · Add Product (picker of products not yet in this diagram + "Create new product…" which creates it via the API) · Add Module · Add Note · Add Connection (C: click source node then target node; dragging from a handle always works too) · Zoom out / zoom % / Zoom in · Fit to screen (Shift+1) · Undo (Ctrl+Z) / Redo (Ctrl+Shift+Z / Ctrl+Y) · Save (Ctrl+S) · node search box (filters by label; Enter cycles matches, centres and highlights them).
- **Interaction**: plain click on a `product` node opens `/products/[refProductId]`; click on a `module` linked to a feature opens that feature's task list (`/products/[id]?tab=tasks&feature=[featureId]`). (UX rule: "click node opens the right product".) Dragging never counts as a click. Selection: marquee drag in Select mode, Shift+click to add; Delete/Backspace removes selected nodes/edges. Double-click a module/note to rename inline. Right-click a node → context menu: Open, Rename (product nodes rename the product via the API), Set as center, Link to feature (modules), Change colour, Delete.
- **Undo/redo**: snapshot stack of `{nodes, edges}` (cap 100) on every structural change and drag end.
- **Saving**: explicit Save (button + Ctrl+S) → `PUT` whole diagram. Dirty indicator ("Unsaved changes"); `beforeunload` warning and an in-app confirm (Save / Discard / Cancel) when navigating away dirty — including when a node click would navigate. On 409, offer "Reload latest" or "Overwrite" (overwrite = re-PUT with the new `baseUpdatedAt`). Refresh after save shows the exact same positions and connections.
- Read-only (MEMBER role): canvas pannable/zoomable/searchable and nodes clickable, editing tools hidden.

## 8. Seed data (`prisma db seed`; dev script seeds only when the DB is empty)

Dates are **relative to the seed run date** so overdue / late states always exist.
- Users: `admin@archboard.local` / `Admin@123` (ADMIN), `manager@archboard.local` / `Manager@123` (MANAGER), and 4 members (`<name>@archboard.local` / `Member@123`) with Vietnamese names.
- Products: Phantom R3, Veronica, Veronica Hub, AI Agent, Chatbot AI, Neo Vision Pro, Vali Denoise, Smart Canteen, SmartICR Post — each with a realistic Vietnamese description, lucide icon, colour, status, owner, dates.
- Phantom R3 features exactly as in the brief (Hardware ×5, Firmware ×4, Backend ×4, Frontend ×4). "Wi-Fi Communication" gets exactly the 5 tasks from the brief. Other features get 2–4 tasks. Across the seed include: every status, some open overdue, some completed on time, some completed late, unassigned tasks, tasks without deadline, checklists, comments, history rows.
- Other products: 3–5 features each, 2–4 tasks per feature.
- Diagrams:
  - Phantom R3: center node Phantom R3 with Veronica Hub (top), AI Agent (upper-left), Neo Vision Pro (upper-right), Vali Denoise (lower-left), Smart Canteen (lower-right), Chatbot AI (bottom), connected to the center. Beside it (to the right), the owner's reference cluster from `docs/phantom-r3-reference.png` as MODULE nodes **PhantomR3A, PhantomR3B, PhantomR3C, PhantomR3V** with: R3A→R3V, R3B→R3V, R3C↔R3V (BOTH), R3A→R3B labelled "Wav", R3C→R3B labelled "all định dạng", and a NOTE: "Thể thức truyền là wifi blockchain và file luôn được mã hóa khi truyền đảm bảo tính toàn vẹn". **(call)**
  - Veronica: center Veronica with Veronica Hub, AI Agent, Chatbot AI.
  - Others: none saved (they get the default center node).

## 9. Testing (owner asked for TDD + Playwright E2E)

- TDD red→green per behaviour (`ecc:tdd-workflow`). Commit test-first, then implementation.
- Backend unit tests (Jest) for pure domain logic: overdue/effectiveStatus, completion/late rules, progress, status partition, on-time rate, report bucketing, permission checks, diagram payload validation.
- Backend integration tests (Jest + supertest) against a throwaway embedded Postgres (random free port, temp data dir, `prisma migrate deploy`), covering every endpoint's happy path + auth/permission/validation failures.
- Frontend unit tests (Vitest + Testing Library) for non-trivial client logic: canvas undo/redo reducer, diagram ↔ React Flow mapping, URL filter state, date/timeline layout maths.
- E2E (Playwright, `e2e/`) runs the whole stack on the E2E ports against a fresh seeded DB, covering the acceptance criteria: login; dashboard numbers; product CRUD + search/filter/sort; feature CRUD with delete warning; task CRUD, assignment, status change, checklist, comment, attachment upload; overdue detection when a deadline is moved into the past and cleared when moved forward; completing a task updates feature/product progress and dashboard; kanban drag changes status; timeline and calendar render tasks; canvas: add product node, connect, rename, move, save, reload → persisted, click node → correct product, undo/redo; report export downloads a file; MEMBER cannot see edit controls and gets 403 from the API.
- Target ≥80% line coverage on backend; report actual numbers honestly.

## 10. Dev & deploy

- `npm install` at root, then `npm run dev` → `scripts/dev.mjs`: if `DATABASE_URL` is unset, start embedded Postgres on 5433 with persistent data in `.pgdata/` (gitignored); run `prisma migrate deploy`; seed if `users` is empty; start backend (watch) and frontend (dev); Ctrl+C stops all three cleanly. Works on Windows.
- `npm run db:reset` → drop + migrate + seed.
- `.env.example` at root documenting: `DATABASE_URL, JWT_SECRET, APP_TIMEZONE, UPLOAD_DIR, BACKEND_URL, PORT, NODE_ENV`.
- Production: `docker-compose.yml` with `postgres:17`, `backend` (multi-stage Dockerfile, runs `prisma migrate deploy` then `node dist/main`), `frontend` (Next standalone output), named volumes for db data and uploads, healthchecks. `docker-compose.dev.yml` runs just Postgres on 5433 for Docker users.
- `README.md`: quick start, demo accounts, scripts, architecture overview, deployment.
