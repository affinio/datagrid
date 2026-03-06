import { describe, expect, it } from "vitest"
import {
  DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY,
  DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP,
} from "../clientRowProjectionStageRegistry"

describe("clientRowProjectionStageRegistry", () => {
  it("registers all projection stages in deterministic order", () => {
    expect(DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY.map(stage => stage.id)).toEqual([
      "compute",
      "filter",
      "sort",
      "group",
      "pivot",
      "aggregate",
      "paginate",
      "visible",
    ])
  })

  it("declares stage dependencies from compute root", () => {
    expect(DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.compute.dependsOn).toEqual([])
    expect(DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.filter.dependsOn).toEqual(["compute"])
    expect(DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.sort.dependsOn).toEqual(["filter"])
    expect(DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.group.dependsOn).toEqual(["sort"])
    expect(DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.pivot.dependsOn).toEqual(["group"])
    expect(DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.aggregate.dependsOn).toEqual(["pivot"])
    expect(DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.paginate.dependsOn).toEqual(["aggregate"])
    expect(DATAGRID_CLIENT_PROJECTION_STAGE_REGISTRY_MAP.visible.dependsOn).toEqual(["paginate"])
  })
})
