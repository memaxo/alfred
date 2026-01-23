export function expandWaveIds(
  waves: Array<{ id: string; dependsOn: string[] }>,
  selected: string[]
): string[] {
  const waveById = new Map(waves.map((w) => [w.id, w]));
  const out = new Set<string>();
  const stack = [...selected];

  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || out.has(id)) {
      continue;
    }
    out.add(id);
    const wave = waveById.get(id);
    if (!wave) {
      continue;
    }
    for (const dep of wave.dependsOn) {
      if (!out.has(dep)) {
        stack.push(dep);
      }
    }
  }

  return [...out];
}

