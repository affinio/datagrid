import type {
  DataGridComputedFieldDefinition,
  DataGridFormulaFieldDefinition,
  DataGridRowId,
} from "./rowModel.js"
import type { DataGridCompiledFormulaField } from "./formulaEngine.js"
import type {
  ApplyComputedFieldsToSourceRowsResult,
} from "./clientRowComputedExecutionRuntime.js"

export interface ClientRowComputedBootstrapRuntimeContext<T> {
  initialComputedFields?: readonly DataGridComputedFieldDefinition<T>[]
  initialFormulaFields?: readonly DataGridFormulaFieldDefinition[]

  normalizeComputedName: (value: unknown) => string
  normalizeComputedTargetField: (value: unknown, fallbackName: string) => string
  resolveInitialComputedRegistrationOrder: (
    definitions: readonly DataGridComputedFieldDefinition<T>[],
  ) => readonly DataGridComputedFieldDefinition<T>[]

  registerComputedFieldInternal: (definition: DataGridComputedFieldDefinition<T>) => void
  compileFormulaFieldDefinition: (
    definition: DataGridFormulaFieldDefinition,
    options: {
      knownComputedNames?: ReadonlySet<string>
      knownComputedNameByField?: ReadonlyMap<string, string>
    },
  ) => DataGridCompiledFormulaField<T>
  registerFormulaFieldInternal: (
    definition: DataGridFormulaFieldDefinition,
    options: {
      knownComputedNames?: ReadonlySet<string>
      knownComputedNameByField?: ReadonlyMap<string, string>
    },
  ) => void

  applyComputedFieldsToSourceRows: () => ApplyComputedFieldsToSourceRowsResult<T>
  commitFormulaDiagnostics: (diagnostics: ApplyComputedFieldsToSourceRowsResult<T>["formulaDiagnostics"]) => void
  commitFormulaComputeStageDiagnostics: (diagnostics: ApplyComputedFieldsToSourceRowsResult<T>["computeStageDiagnostics"]) => void
  bumpRowVersions: (rowIds: readonly DataGridRowId[]) => void
}

export interface ClientRowComputedBootstrapRuntime<T> {
  bootstrapInitialComputedAndFormulaFields: () => void
}

export function createClientRowComputedBootstrapRuntime<T>(
  context: ClientRowComputedBootstrapRuntimeContext<T>,
): ClientRowComputedBootstrapRuntime<T> {
  const runInitialRecompute = (): void => {
    const initialRecompute = context.applyComputedFieldsToSourceRows()
    context.commitFormulaDiagnostics(initialRecompute.formulaDiagnostics)
    context.commitFormulaComputeStageDiagnostics(initialRecompute.computeStageDiagnostics)
    if (initialRecompute.changed) {
      context.bumpRowVersions(initialRecompute.changedRowIds)
    }
  }

  const bootstrapInitialComputedAndFormulaFields = (): void => {
    if (Array.isArray(context.initialComputedFields) && context.initialComputedFields.length > 0) {
      const orderedInitialComputedFields = context.resolveInitialComputedRegistrationOrder(context.initialComputedFields)
      for (const definition of orderedInitialComputedFields) {
        context.registerComputedFieldInternal(definition)
      }
      runInitialRecompute()
    }

    if (Array.isArray(context.initialFormulaFields) && context.initialFormulaFields.length > 0) {
      const initialFormulaNames = new Set<string>()
      const initialFormulaNameByField = new Map<string, string>()
      const compiledByName = new Map<string, DataGridCompiledFormulaField<T>>()
      const initialFormulaDefinitions: DataGridComputedFieldDefinition<T>[] = []

      for (const definition of context.initialFormulaFields) {
        const normalizedName = context.normalizeComputedName(definition.name)
        const normalizedField = context.normalizeComputedTargetField(definition.field, normalizedName)
        if (initialFormulaNames.has(normalizedName)) {
          throw new Error(
            `[DataGridFormula] Duplicate formula field '${normalizedName}' in initialFormulaFields.`,
          )
        }
        if (initialFormulaNameByField.has(normalizedField)) {
          throw new Error(
            `[DataGridFormula] Duplicate formula target field '${normalizedField}' in initialFormulaFields.`,
          )
        }
        initialFormulaNames.add(normalizedName)
        initialFormulaNameByField.set(normalizedField, normalizedName)
      }

      for (const definition of context.initialFormulaFields) {
        const compiled = context.compileFormulaFieldDefinition(definition, {
          knownComputedNames: initialFormulaNames,
          knownComputedNameByField: initialFormulaNameByField,
        })
        compiledByName.set(compiled.name, compiled)
        initialFormulaDefinitions.push({
          name: compiled.name,
          field: compiled.field,
          deps: compiled.deps,
          compute: compiled.compute,
        })
      }

      const orderedInitialFormulaFields = context.resolveInitialComputedRegistrationOrder(initialFormulaDefinitions)
      for (const definition of orderedInitialFormulaFields) {
        const formulaName = context.normalizeComputedName(definition.name)
        const compiled = compiledByName.get(formulaName)
        if (!compiled) {
          continue
        }
        context.registerFormulaFieldInternal({
          name: compiled.name,
          field: compiled.field,
          formula: compiled.formula,
        }, {
          knownComputedNames: initialFormulaNames,
          knownComputedNameByField: initialFormulaNameByField,
        })
      }

      runInitialRecompute()
    }
  }

  return {
    bootstrapInitialComputedAndFormulaFields,
  }
}
