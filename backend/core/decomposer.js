function validateDependencies(subtasks) {
  if (!subtasks || !Array.isArray(subtasks)) return [];

  const taskIds = new Set(subtasks.map(t => t.id));

  return subtasks.map(task => {
    let deps = task.dependsOn || [];
    
    // Rule: Task id=1 must have dependsOn=[] always
    if (task.id === 1) {
      deps = [];
    }

    // Filter missing and circular
    // For circular, a simple check: can't depend on itself, and for a simple DAG, 
    // a task should generally only depend on tasks with a lower ID.
    // A full topological cycle detection might be complex, but let's do a strict check:
    // dependsOn IDs must exist in taskIds, and must not include its own ID.
    // Also, to prevent circular references A->B, B->A, we can enforce that a task can only depend on tasks appearing before it or with a smaller ID.
    // The prompt says: "If any id in dependsOn is missing or circular: remove the bad reference and log a warning"
    const validDeps = [];
    for (const depId of deps) {
      if (!taskIds.has(depId)) {
        console.warn(`[validateDependencies] Removing missing dependency ${depId} from task ${task.id}`);
        continue;
      }
      if (depId === task.id) {
        console.warn(`[validateDependencies] Removing self dependency ${depId} from task ${task.id}`);
        continue;
      }
      validDeps.push(depId);
    }
    
    // Basic cycle detection (dfs)
    // To strictly find cycles and remove the exact dependency causing it
    task.dependsOn = validDeps;
    return task;
  });
}

function removeCircularDependencies(subtasks) {
  // Build adjacency list
  const adj = new Map();
  subtasks.forEach(t => adj.set(t.id, t.dependsOn));
  
  // Find cycles and remove the back-edge
  const visiting = new Set();
  const visited = new Set();
  
  function dfs(nodeId, path) {
    visiting.add(nodeId);
    path.push(nodeId);
    
    const deps = adj.get(nodeId) || [];
    const safeDeps = [];
    
    for (const dep of deps) {
      if (visiting.has(dep)) {
        console.warn(`[validateDependencies] Circular dependency detected: ${nodeId} -> ${dep}. Removing.`);
        continue;
      }
      if (!visited.has(dep)) {
        dfs(dep, [...path]);
      }
      safeDeps.push(dep);
    }
    
    adj.set(nodeId, safeDeps);
    visiting.delete(nodeId);
    visited.add(nodeId);
  }
  
  for (const t of subtasks) {
    if (!visited.has(t.id)) {
      dfs(t.id, []);
    }
  }
  
  return subtasks.map(t => ({ ...t, dependsOn: adj.get(t.id) }));
}

function fullValidateDependencies(subtasks) {
  let cleaned = validateDependencies(subtasks);
  cleaned = removeCircularDependencies(cleaned);
  return cleaned;
}

function buildExecutionOrder(subtasks) {
  const waves = [];
  const placed = new Set();
  const remaining = [...subtasks];

  while (remaining.length > 0) {
    const wave = [];
    for (let i = remaining.length - 1; i >= 0; i--) {
      const task = remaining[i];
      // A task can run if all its dependencies are in `placed`
      const canRun = task.dependsOn.every(depId => placed.has(depId));
      if (canRun) {
        wave.push(task);
        remaining.splice(i, 1);
      }
    }

    if (wave.length === 0 && remaining.length > 0) {
      // Unresolvable dependencies (e.g. somehow still circular or disconnected but we removed missing deps)
      // Just put the rest in the final wave to avoid infinite loop
      console.warn("[buildExecutionOrder] Unresolvable dependencies, forcing remaining tasks to final wave.");
      waves.push(remaining.splice(0, remaining.length).map(t => t.id));
      break;
    }
    
    // Add to waves (reverse because we spliced backwards, but let's just push IDs)
    // Actually, let's sort the wave by ID for consistency
    wave.sort((a, b) => a.id - b.id);
    waves.push(wave.map(t => t.id));
    
    for (const t of wave) {
      placed.add(t.id);
    }
  }

  return waves;
}

function enrichSubtasks(subtasks, availableModels) {
  const waves = buildExecutionOrder(subtasks);
  const taskToWave = new Map();
  
  waves.forEach((waveIds, waveIndex) => {
    waveIds.forEach(id => taskToWave.set(id, waveIndex));
  });

  return subtasks.map(task => {
    const model = availableModels.find(m => m.id === task.assignedModel);
    return {
      ...task,
      canRunInParallel: task.dependsOn.length === 0,
      wave: taskToWave.get(task.id) !== undefined ? taskToWave.get(task.id) : 0,
      modelDisplayName: model ? model.displayName : task.assignedModel
    };
  });
}

function decompose(prompt, category, availableModels, rawSubtasks) {
  // rawSubtasks are passed from router, or we receive the subtasks directly
  // The spec says: decompose(prompt, category, availableModels) -> subtaskArray
  // "decompose() receives the raw subtask array from the router and:"
  // But wait, the spec says "Export: decompose(prompt, category, availableModels) -> subtaskArray"
  // And "decompose() receives the raw subtask array from the router". 
  // Let's make the signature decompose(prompt, category, availableModels, rawSubtasks) or just decompose(rawSubtasks, availableModels).
  // I will define it as decompose(rawSubtasks, availableModels) since prompt and category aren't strictly needed for graph resolution, but I will match the signature `decompose(prompt, category, availableModels, rawSubtasks)` to be safe, or just use `rawSubtasks` if it's passed as the 4th argument, or perhaps `rawSubtasks` is the 1st argument?
  // "Export: decompose(prompt, category, availableModels) -> subtaskArray"
  // Wait, if it doesn't take rawSubtasks as a parameter, how does it get them?
  // Ah! "decompose() receives the raw subtask array from the router"
  // Let's assume the signature is decompose(rawSubtasks, availableModels) and the prompt/category are ignored or passed differently. I'll make it decompose(rawSubtasks, availableModels) because the spec says:
  // "Input: validated subtasks, available models manifest" for enrich.
  // Wait, in my Implementation Plan I wrote: "Exports decompose(rawSubtasks, availableModels)."
  // I will use function decompose(rawSubtasks, availableModels)
  
  let cleaned = fullValidateDependencies(rawSubtasks);
  let enriched = enrichSubtasks(cleaned, availableModels);
  return enriched;
}

module.exports = {
  validateDependencies: fullValidateDependencies,
  buildExecutionOrder,
  enrichSubtasks,
  decompose
};
