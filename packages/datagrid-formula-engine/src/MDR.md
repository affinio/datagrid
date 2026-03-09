# Formula Engine MDR

## Purpose

`src/` is the formula engine package surface and internal implementation layout.

This package owns:
- formula syntax model
- parsing/tokenization
- optimization
- compiled/runtime evaluators
- dependency/execution planning
- explain/diagnostics helpers

This package does not own:
- row-model orchestration
- projection staging
- grid UI integration

## Root Files

- `index.ts`
  - Public package entrypoint.
- `contracts.ts`
  - Package-level public contracts.
- `coreTypes.ts`
  - Bridge types used by the engine/runtime integration surface.

## Folder Ownership

- `syntax/`
  - Syntax-facing ownership:
    - AST contracts
    - tokenizer
    - parser
    - optimizer
    - value semantics
    - built-in function definitions
    - syntax/explain analysis glue
- `runtime/`
  - Compile/runtime orchestration:
    - compile pipeline
    - evaluator selection
    - runtime-facing contracts
- `evaluators/`
  - Backend implementations:
    - `interpreter`
    - `jit`
    - `columnar`
    - `vector`
    - `shared`
- `graph/`
  - Execution-plan and dependency-ordering helpers.
- `dependency/`
  - Dependency-oriented exports and graph-facing integration layer.
- `analysis/`
  - Diagnostics/explain result contracts and analysis-facing types.

## Transitional Note

- `formulaEngine/`
  - Transitional compatibility layer.
  - New implementation ownership should go to `syntax/`, `runtime/`, `evaluators/`, `graph/`, or `analysis/`.
  - Do not add new logic here unless it is a deliberate compatibility shim.

## Placement Rules

- Put syntax ownership in `syntax/`.
- Put backend execution logic in `evaluators/`.
- Put compile/runtime orchestration in `runtime/`.
- Put dependency/execution-plan ownership in `graph/` or `dependency/`.
- Put diagnostics/explain result types in `analysis/`.
- Avoid creating thin files that only proxy another file unless they exist as an intentional compatibility shim.

## Reading Order

1. `contracts.ts`
2. `coreTypes.ts`
3. `syntax/`
4. `runtime/`
5. `evaluators/`
6. `graph/`
7. `analysis/`
