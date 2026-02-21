function normalizeFieldPath(field) {
    return field.trim();
}
function splitFieldPath(field) {
    if (field.length === 0) {
        return [];
    }
    return field.split(".").filter(Boolean);
}
function fieldPathsOverlap(left, right) {
    return (left === right ||
        left.startsWith(`${right}.`) ||
        right.startsWith(`${left}.`));
}
function createStructuralSourceTrieNode() {
    return {
        children: new Map(),
        terminalSources: new Set(),
        subtreeSources: new Set(),
    };
}
export function createDataGridDependencyGraph(initialDependencies = [], options = {}) {
    const cyclePolicy = options.cyclePolicy ?? "throw";
    const structuralDependentsBySource = new Map();
    const computedDependentsBySource = new Map();
    const outgoingEdgesBySource = new Map();
    const structuralSourceTrieRoot = createStructuralSourceTrieNode();
    const addMapEdge = (targetMap, sourceField, dependentField) => {
        const existing = targetMap.get(sourceField);
        if (existing) {
            if (existing.has(dependentField)) {
                return false;
            }
            existing.add(dependentField);
            return true;
        }
        targetMap.set(sourceField, new Set([dependentField]));
        return true;
    };
    const addOutgoingEdge = (sourceField, dependentField) => {
        const existing = outgoingEdgesBySource.get(sourceField);
        if (existing) {
            existing.add(dependentField);
            return;
        }
        outgoingEdgesBySource.set(sourceField, new Set([dependentField]));
    };
    const hasOutgoingPath = (fromField, toField) => {
        if (fromField === toField) {
            return true;
        }
        const visited = new Set();
        const stack = [fromField];
        while (stack.length > 0) {
            const current = stack.pop();
            if (!current || visited.has(current)) {
                continue;
            }
            visited.add(current);
            const neighbors = outgoingEdgesBySource.get(current);
            if (!neighbors || neighbors.size === 0) {
                continue;
            }
            if (neighbors.has(toField)) {
                return true;
            }
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    stack.push(neighbor);
                }
            }
        }
        return false;
    };
    const insertStructuralSource = (sourceField) => {
        const segments = splitFieldPath(sourceField);
        let currentNode = structuralSourceTrieRoot;
        currentNode.subtreeSources.add(sourceField);
        for (const segment of segments) {
            const existing = currentNode.children.get(segment);
            if (existing) {
                currentNode = existing;
            }
            else {
                const next = createStructuralSourceTrieNode();
                currentNode.children.set(segment, next);
                currentNode = next;
            }
            currentNode.subtreeSources.add(sourceField);
        }
        currentNode.terminalSources.add(sourceField);
    };
    const collectOverlappingStructuralSources = (fieldPath) => {
        if (fieldPath.length === 0) {
            return new Set();
        }
        const segments = splitFieldPath(fieldPath);
        const overlappingSources = new Set();
        let currentNode = structuralSourceTrieRoot;
        for (const sourceField of currentNode.terminalSources) {
            overlappingSources.add(sourceField);
        }
        for (const segment of segments) {
            currentNode = currentNode.children.get(segment);
            if (!currentNode) {
                break;
            }
            for (const sourceField of currentNode.terminalSources) {
                overlappingSources.add(sourceField);
            }
        }
        if (currentNode) {
            for (const sourceField of currentNode.subtreeSources) {
                overlappingSources.add(sourceField);
            }
        }
        return overlappingSources;
    };
    const registerDependency = (sourceField, dependentField, registerOptions = {}) => {
        const normalizedSourceField = normalizeFieldPath(sourceField);
        const normalizedDependentField = normalizeFieldPath(dependentField);
        if (normalizedSourceField.length === 0 || normalizedDependentField.length === 0) {
            return;
        }
        const kind = registerOptions.kind ?? "structural";
        const targetMap = kind === "computed"
            ? computedDependentsBySource
            : structuralDependentsBySource;
        const alreadyExistsForKind = targetMap.get(normalizedSourceField)?.has(normalizedDependentField) ?? false;
        if (alreadyExistsForKind) {
            return;
        }
        const outgoingEdgeExists = outgoingEdgesBySource.get(normalizedSourceField)?.has(normalizedDependentField) ?? false;
        if (!outgoingEdgeExists) {
            const createsSelfCycle = normalizedSourceField === normalizedDependentField;
            const createsGraphCycle = hasOutgoingPath(normalizedDependentField, normalizedSourceField);
            if ((createsSelfCycle || createsGraphCycle) && cyclePolicy === "throw") {
                throw new Error(`[DataGridDependencyGraph] Cycle detected for dependency '${normalizedSourceField}' -> '${normalizedDependentField}'.`);
            }
        }
        const inserted = addMapEdge(targetMap, normalizedSourceField, normalizedDependentField);
        if (!inserted) {
            return;
        }
        if (kind === "structural") {
            insertStructuralSource(normalizedSourceField);
        }
        addOutgoingEdge(normalizedSourceField, normalizedDependentField);
    };
    for (const dependency of initialDependencies) {
        registerDependency(dependency.sourceField, dependency.dependentField, { kind: dependency.kind });
    }
    const getAffectedFields = (changedFields) => {
        if (changedFields.size === 0 ||
            (structuralDependentsBySource.size === 0 && computedDependentsBySource.size === 0)) {
            return new Set(changedFields);
        }
        const affected = new Set();
        const queue = [];
        for (const changedField of changedFields) {
            const normalizedField = normalizeFieldPath(changedField);
            if (normalizedField.length === 0 || affected.has(normalizedField)) {
                continue;
            }
            affected.add(normalizedField);
            queue.push(normalizedField);
        }
        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            if (structuralDependentsBySource.size > 0) {
                const overlappingSources = collectOverlappingStructuralSources(current);
                for (const sourceField of overlappingSources) {
                    const dependentFields = structuralDependentsBySource.get(sourceField);
                    if (!dependentFields) {
                        continue;
                    }
                    for (const dependentField of dependentFields) {
                        if (affected.has(dependentField)) {
                            continue;
                        }
                        affected.add(dependentField);
                        queue.push(dependentField);
                    }
                }
            }
            const computedDependents = computedDependentsBySource.get(current);
            if (!computedDependents) {
                continue;
            }
            for (const dependentField of computedDependents) {
                if (affected.has(dependentField)) {
                    continue;
                }
                affected.add(dependentField);
                queue.push(dependentField);
            }
        }
        return affected;
    };
    const affectsAny = (changedFields, dependencyFields) => {
        if (changedFields.size === 0 || dependencyFields.size === 0) {
            return false;
        }
        for (const changed of changedFields) {
            for (const dependency of dependencyFields) {
                if (fieldPathsOverlap(changed, dependency)) {
                    return true;
                }
            }
        }
        return false;
    };
    return {
        registerDependency,
        getAffectedFields,
        affectsAny,
    };
}
