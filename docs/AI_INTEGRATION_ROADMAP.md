# Affino AI Integration Roadmap

## Purpose

This document defines the preparation pipeline for integrating AI agents into the Affino ecosystem.

The goal is not to attach a chatbot to the UI. The goal is to prepare a clean command/config architecture where any AI provider can safely interact with Affino systems:

- OpenAI
- Claude
- Gemini
- local LLM
- internal backend agent
- rule-based assistant
- future custom agent

The key principle:

```text
AI should not control the DOM.
AI should control validated declarative application commands and configs.

Instead of:
AI clicks buttons, parses UI, and manipulates components directly.

We want:
AI receives schema/context
AI proposes structured commands
System validates commands
User previews/confirms
Application state/config updates
UI reacts normally
```

## 1. Current Affino Foundation

Affino already has several reusable layers that can support AI-driven workflows once commands, validation, preview, and approval boundaries are explicit.

### 1.1 DataGrid Layer

Responsible for:

- rows
- columns
- selection
- ranges
- filters
- sorting
- grouping
- editing
- formulas
- server datasource
- history / undo / redo

Potential AI use:

- "Filter rows where status is active"
- "Explain selected rows"
- "Create a chart from selected range"
- "Find anomalies in this column"

### 1.2 Analytics Layer

Package:

- `@affino/analytics-core`

Responsible for:

- schema inference
- filters
- dimensions
- measures
- group by
- aggregation
- sorting
- limiting
- dataset creation

Example:

```ts
createAnalyticsDataset(rows, {
  filters: [{ field: "status", op: "equals", value: "active" }],
  dimensions: [{ field: "region" }],
  measures: [{ field: "revenue", op: "sum", as: "revenue" }],
  sort: [{ field: "revenue", direction: "desc" }],
})
```

Potential AI use:

- "Show revenue by region"
- "Create a metric for total orders"
- "Group this data by month"

### 1.3 Charts Layer

Packages:

- `@affino/charts-core`
- `@affino/charts-vue`

`@affino/charts-core` is headless and provides:

- metric model
- bar geometry
- line geometry
- area geometry
- scatter/bubble geometry
- pie/donut geometry
- histogram geometry
- scales
- plot area helpers
- data access helpers

`@affino/charts-vue` provides Vue SVG components:

- `AffinoMetricCard`
- `AffinoBarChart`
- `AffinoLineChart`
- `AffinoAreaChart`
- `AffinoScatterChart`
- `AffinoPieChart`
- `AffinoHistogram`
- `AffinoChartFrame`
- `AffinoChartLegend`

Important design:

- `charts-core` = calculations / geometry / models
- `charts-vue` = rendering / interaction / theme tokens

Potential AI use:

- "Create a dashboard with revenue, trend and channel split"
- "Show discount vs revenue as scatter chart"
- "Show load time distribution"

### 1.4 World Map Layer

Packages:

- `@affino/world-map-core`
- `@affino/world-map-vue`

`@affino/world-map-core` provides:

- country geometry types
- lon/lat projection
- SVG path generation
- antimeridian handling

`@affino/world-map-vue` provides:

- SVG world map
- country hover/select
- markers by lon/lat
- marker interaction payloads
- choropleth values
- zoom/pan/reset
- theme tokens
- external popover-ready anchor payloads

Potential AI use:

- "Show all devices on the map"
- "Highlight offline devices"
- "Create a marker layer from GPS data"
- "Show revenue by country"

## 2. Target AI Architecture

The intended AI pipeline:

```text
User request
  -> AI Agent
  -> Intent / Plan
  -> Affino Command Model
  -> Validation / Permissions / Preview
  -> Execution
  -> DataGrid / Analytics / Charts / Map / Dashboard
```

Technical flow:

```text
AI model
  -> tool schemas / actions
  -> command registry
  -> state/config stores
  -> UI packages
```

AI must not manipulate UI components directly.

AI should produce structured commands such as:

```json
{
  "type": "chart.create",
  "chartType": "bar",
  "title": "Revenue by Region",
  "source": { "type": "grid", "gridId": "orders" },
  "query": {
    "dimensions": [{ "field": "region" }],
    "measures": [{ "field": "revenue", "op": "sum", "as": "revenue" }],
    "sort": [{ "field": "revenue", "direction": "desc" }]
  },
  "encoding": {
    "categoryField": "region",
    "valueField": "revenue"
  }
}
```

## 3. Core Principle

### 3.1 AI Is a Command Producer

AI should produce:

- plans
- commands
- dashboard configs
- chart configs
- map layer configs
- filter configs
- explanations

AI should not directly:

- mutate DOM
- execute arbitrary JavaScript
- run arbitrary SQL
- call backend mutations without validation
- bypass permissions
- silently change user data

### 3.2 System Owns Validation

Every AI output must pass through:

```text
AI command
  -> schema validation
  -> field/type validation
  -> permission validation
  -> dry-run preview
  -> user confirmation
  -> execution
```

## 4. Future Packages

These packages are planned architecture. They are not documented here as implemented packages until they exist in the repository.

### 4.1 `@affino/action-core`

Headless command model and execution layer.

Responsibilities:

- command types
- command registry
- command validation
- command preview
- command execution
- command history
- undo metadata

Suggested structure:

```text
packages/action-core/
  src/
    commands/
      AffinoCommand.ts
      chartCommands.ts
      gridCommands.ts
      mapCommands.ts
      dashboardCommands.ts

    registry/
      CommandRegistry.ts

    validation/
      validateCommand.ts
      CommandValidationResult.ts

    execution/
      executeCommand.ts
      CommandExecutionContext.ts

    preview/
      previewCommand.ts

    history/
      ActionLog.ts

    index.ts
```

Example command types:

```ts
type AffinoCommand =
  | CreateChartCommand
  | UpdateChartCommand
  | ApplyGridFilterCommand
  | CreateMetricCommand
  | CreateMapLayerCommand
  | ExplainSelectionCommand
  | SummarizeDatasetCommand
```

### 4.2 `@affino/agent-core`

AI-provider-agnostic agent layer.

Responsibilities:

- agent context creation
- compact dataset summaries
- tool schemas
- prompt templates
- model adapter interfaces
- plan parsing
- command generation

Important:

`agent-core` should not depend directly on OpenAI, Claude, Gemini, etc.

Instead:

```ts
interface AiModelAdapter {
  complete(request: AgentRequest): Promise<AgentResponse>
}
```

Possible adapters later:

- `@affino/agent-openai`
- `@affino/agent-claude`
- `@affino/agent-gemini`
- `@affino/agent-local`

### 4.3 `@affino/dashboard-core`

Headless dashboard config model.

Responsibilities:

- dashboard config
- widget config
- layout config
- chart widget config
- metric widget config
- map widget config
- grid widget config

Example:

```ts
interface DashboardState {
  widgets: DashboardWidgetConfig[]
  filters: FilterConfig[]
  selectedRows?: string[]
  layout: DashboardLayoutConfig
}

type DashboardWidgetConfig =
  | ChartWidgetConfig
  | MetricWidgetConfig
  | MapWidgetConfig
  | GridWidgetConfig

interface ChartWidgetConfig {
  id: string
  type: "bar" | "line" | "area" | "pie" | "scatter" | "histogram"
  title?: string
  source: DataSourceRef
  query: AnalyticsQuery
  encoding: ChartEncoding
}
```

### 4.4 `@affino/dashboard-vue`

Vue renderer for dashboard configs.

Responsibilities:

- render dashboard layout
- render chart widgets
- render metric widgets
- render map widgets
- render grid widgets
- handle widget selection/editing
- support layout changes

Example:

```vue
<AffinoDashboard :config="dashboardConfig" />
```

## 5. AI-Ready Data Context

AI should not receive the full dataset by default.

Instead, the app should provide compact context.

### 5.1 Dataset Context

Example:

```ts
interface AgentDatasetContext {
  datasetId: string
  rowCount: number
  selectedRowCount: number
  fields: FieldSummary[]
  sampleRows: Record<string, unknown>[]
  numericStats: Record<string, NumericSummary>
  categoricalStats: Record<string, CategorySummary>
  currentFilters: unknown[]
}

interface FieldSummary {
  id: string
  label?: string
  type: "string" | "number" | "boolean" | "date" | "datetime" | "unknown"
  uniqueCount?: number
  nullable?: boolean
}

interface NumericSummary {
  min: number
  max: number
  avg: number
  sum?: number
  nullCount: number
}

interface CategorySummary {
  topValues: Array<{
    value: string
    count: number
  }>
  uniqueCount: number
}
```

Example compact context:

```json
{
  "rowCount": 24,
  "selectedRowCount": 8,
  "fields": [
    { "id": "region", "type": "string", "uniqueCount": 4 },
    { "id": "revenue", "type": "number", "min": 31800, "max": 78300 },
    { "id": "monthIndex", "type": "number", "min": 1, "max": 6 }
  ]
}
```

## 6. Command Model

### 6.1 Chart Command

```ts
interface CreateChartCommand {
  type: "chart.create"
  chartType: "bar" | "line" | "area" | "pie" | "scatter" | "histogram"
  title: string
  source: DataSourceRef
  query: AnalyticsQuery
  encoding: Record<string, string>
}
```

### 6.2 Metric Command

```ts
interface CreateMetricCommand {
  type: "metric.create"
  title: string
  source: DataSourceRef
  query: AnalyticsQuery
  valueField: string
  format?: "number" | "percent" | "currency" | "compact" | "raw"
}
```

### 6.3 Grid Filter Command

```ts
interface ApplyGridFilterCommand {
  type: "grid.filter.apply"
  gridId: string
  filters: Array<{
    field: string
    op: string
    value?: unknown
  }>
}
```

### 6.4 Map Layer Command

```ts
interface CreateMapLayerCommand {
  type: "map.layer.create"
  mapId: string
  source: DataSourceRef
  layerType: "markers" | "choropleth"
  latitudeField?: string
  longitudeField?: string
  countryIdField?: string
  valueField?: string
}
```

### 6.5 Explain Selection Command

```ts
interface ExplainSelectionCommand {
  type: "selection.explain"
  source: DataSourceRef
  selectionRef: string
}
```

## 7. Validation Layer

All commands must be validated before execution.

Validation checks:

- command type is known
- required fields exist
- fields exist in dataset schema
- field types are compatible
- aggregation operations are allowed
- chart type matches encoding
- source exists
- permissions allow this action
- command does not exceed size/cost limits

Example:

```ts
validateCreateChartCommand(command, context)
```

Validation result:

```ts
interface CommandValidationResult {
  valid: boolean
  errors: CommandValidationError[]
  warnings: CommandValidationWarning[]
}
```

Example invalid request:

```text
chartType = line
xField = region
yField = revenue
```

Warning:

```text
Line chart usually expects an ordered numeric/date/category x field.
Bar chart may be more appropriate for region vs revenue.
```

## 8. Preview / Dry Run

Before applying commands, system should preview the result.

Example:

```ts
const preview = previewCommand(command)
```

Preview result:

```ts
interface CommandPreview {
  command: AffinoCommand
  title: string
  description: string
  affectedWidgets?: string[]
  previewRows?: Record<string, unknown>[]
  warnings?: string[]
}
```

Example preview:

```text
AI proposes to create:
- Metric: Total Revenue
- Bar Chart: Revenue by Region
- Line Chart: Revenue by Month
- Donut Chart: Orders by Channel

User sees:
[Apply] [Cancel]
```

## 9. Execution Layer

Execution should update state/config, not DOM.

Example:

```ts
executeCommand(command, context)
```

Execution examples:

```text
chart.create
  -> dashboardStore.addWidget(chartConfig)

grid.filter.apply
  -> gridStore.applyFilter(filterConfig)

map.layer.create
  -> mapStore.addLayer(mapLayerConfig)
```

## 10. Audit Log / Undo

Every AI-proposed or AI-applied action should be logged.

```ts
interface AgentActionLog {
  id: string
  userPrompt: string
  commands: AffinoCommand[]
  status: "proposed" | "applied" | "rejected" | "failed"
  createdAt: string
  appliedAt?: string
}
```

Undo should be possible where practical.

Example:

```text
AI created 3 widgets
Undo removes those 3 widgets
```

## 11. User Approval Flow

Recommended flow:

1. User asks a question
2. App builds context
3. AI returns a plan
4. System validates plan
5. System shows preview
6. User confirms
7. Commands execute
8. Action is logged
9. User can undo

AI should not silently mutate dashboards, filters, data, or backend state unless explicitly allowed.

## 12. Example User Scenarios

### 12.1 Revenue Dashboard

User:

```text
Show revenue by region and monthly trend.
```

AI plan:

1. Create metric: Total Revenue
2. Create bar chart: Revenue by Region
3. Create line chart: Revenue by Month

Commands:

- `metric.create`
- `chart.create` bar
- `chart.create` line

### 12.2 Anomaly Analysis

User:

```text
Find unusual load times.
```

AI plan:

1. Create histogram of `loadTimeMs`
2. Identify high outlier rows
3. Apply grid filter for high `loadTimeMs`

Commands:

- `chart.create` histogram
- `grid.filter.apply`
- `selection.explain`

### 12.3 GPS Device Tracking

User:

```text
Show devices that have not updated recently.
```

AI plan:

1. Filter devices by `lastSeen` age
2. Create metric: Offline Devices
3. Create map marker layer for filtered devices
4. Create table view of affected devices

Commands:

- `grid.filter.apply`
- `metric.create`
- `map.layer.create`
- `chart.create` or `grid.view.create`

### 12.4 Manager Dashboard

User:

```text
Create a manager summary dashboard.
```

AI plan:

1. Create KPI cards
2. Create trend chart
3. Create category breakdown
4. Create summary table
5. Save dashboard layout

Commands:

- `metric.create`
- `chart.create` line
- `chart.create` bar
- `grid.view.create`
- `dashboard.save`

## 13. Security Principles

AI must not have direct access to:

- DOM mutation
- arbitrary JavaScript execution
- arbitrary SQL execution
- backend mutations without validation
- filesystem
- secrets
- credentials
- private data beyond provided context

AI may receive:

- schemas
- summaries
- safe samples
- selected row summaries
- allowed command schemas
- validation feedback

AI may produce:

- proposed commands
- explanations
- dashboard configs
- chart configs
- filter configs
- map layer configs

## 14. Roadmap

### AI-0 / ACT-0: Action Core Package

Create:

- `@affino/action-core`

Add:

- `AffinoCommand`
- `CommandRegistry`
- `CommandValidationResult`
- `CommandExecutionResult`
- `previewCommand()`
- `validateCommand()`
- `executeCommand()`

Initial commands:

- `chart.create`
- `metric.create`
- `grid.filter.apply`
- `selection.explain`
- `map.layer.create`

### AI-1: Dataset Context Provider

Create:

```ts
createAgentDatasetContext(rows, schema, options)
```

Output:

- fields
- rowCount
- selectedRowCount
- sample rows
- numeric summaries
- categorical summaries
- current filters

### AI-2: Chart Recommendation Engine

Deterministic helper, no AI model yet.

```ts
suggestChartsForDataset(context)
```

Rules:

- category + number -> bar / pie
- ordered x + number -> line / area
- number + number -> scatter
- single number -> metric
- number column -> histogram
- lat/lon -> map markers
- country + number -> choropleth

### AI-3: Command Preview UI

Sandbox page:

- AI proposes commands
- System validates
- User previews
- User applies/cancels

No real AI API yet.

### AI-4: Tool Schemas

Define JSON schemas for commands.

Purpose:

- AI providers must return structured commands.

### AI-5: Mock Agent

Create a fake/mock agent that maps natural language examples to commands.

No real AI model yet.

Example:

```text
"show revenue by region"
  -> chart.create bar
```

### AI-6: Real AI Adapter

Only after command layer is stable.

Adapters:

- `@affino/agent-openai`
- `@affino/agent-claude`
- `@affino/agent-gemini`
- `@affino/agent-local`

## 15. Non-Goals For Initial AI Preparation

Do not start with:

- real OpenAI/Claude integration
- chatbot UI
- autonomous backend mutations
- direct SQL generation
- DOM-driving AI
- uncontrolled tool execution
- hidden automatic dashboard changes

Start with:

- command model
- validation
- preview
- deterministic recommendations
- mock agent

## 16. Ideal Final Flow

User asks:

```text
Show me revenue by region and monthly trend
```

App builds context:

- schema
- selected rows
- current filters
- summaries
- available commands

AI returns:

- `chart.create` bar
- `chart.create` line
- `metric.create`

System validates:

- fields exist
- types match
- commands allowed

System previews:

- 3 widgets will be created

User confirms:

- Apply

System executes:

- dashboard config updates
- charts render

Action log:

- saved and undoable

## 17. Guiding Rule

Every future AI integration must follow this rule:

```text
AI proposes.
Affino validates.
User approves.
System executes.
Everything is logged.
```
