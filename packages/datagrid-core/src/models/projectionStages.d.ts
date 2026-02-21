import { type ProjectionStageGraph } from "@affino/projection-engine";
import type { DataGridProjectionStage } from "./rowModel.js";
export type DataGridClientProjectionStage = DataGridProjectionStage;
export type DataGridClientPatchStage = Extract<DataGridClientProjectionStage, "filter" | "sort" | "group" | "aggregate">;
export declare const DATAGRID_CLIENT_PROJECTION_REFRESH_ENTRY_STAGE: DataGridClientProjectionStage;
export declare const DATAGRID_CLIENT_PROJECTION_STAGE_DEPENDENCIES: Readonly<Record<DataGridClientProjectionStage, readonly DataGridClientProjectionStage[]>>;
export declare const DATAGRID_CLIENT_PROJECTION_GRAPH: ProjectionStageGraph<DataGridProjectionStage>;
export declare const DATAGRID_CLIENT_PREPARED_PROJECTION_GRAPH: import("@affino/projection-engine").PreparedProjectionStageGraph<DataGridProjectionStage>;
export declare const DATAGRID_CLIENT_ALL_PROJECTION_STAGES: readonly DataGridClientProjectionStage[];
export declare const DATAGRID_CLIENT_PATCH_STAGE_IDS: readonly DataGridClientPatchStage[];
export declare function expandClientProjectionStages(stages: readonly DataGridClientProjectionStage[]): ReadonlySet<DataGridClientProjectionStage>;
//# sourceMappingURL=projectionStages.d.ts.map