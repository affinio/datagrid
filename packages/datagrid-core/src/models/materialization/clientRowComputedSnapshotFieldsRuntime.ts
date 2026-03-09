export interface CreateClientRowComputedSnapshotFieldsRuntimeOptions {
  getComputedFieldNames: () => readonly string[]
  setComputedFields: (fields: readonly string[]) => boolean
}

export interface ClientRowComputedSnapshotFieldsRuntime {
  markDirty(): void
  sync(): boolean
}

export function createClientRowComputedSnapshotFieldsRuntime(
  options: CreateClientRowComputedSnapshotFieldsRuntimeOptions,
): ClientRowComputedSnapshotFieldsRuntime {
  let computedSnapshotFieldList: readonly string[] = []
  let computedSnapshotFieldsDirty = true

  return {
    markDirty() {
      computedSnapshotFieldsDirty = true
    },
    sync() {
      if (computedSnapshotFieldsDirty) {
        computedSnapshotFieldList = options.getComputedFieldNames()
        computedSnapshotFieldsDirty = false
      }
      return options.setComputedFields(computedSnapshotFieldList)
    },
  }
}
