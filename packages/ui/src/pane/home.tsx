export type HomePaneEntity = {
  id: string;
  type: string;
  state?: unknown;
};

export type HomePaneProps = {
  entities: HomePaneEntity[];
  onToggle?: (id: string, state: unknown) => void;
  className?: string;
};

type RenderEntity = {
  entity: HomePaneEntity;
  formattedState: string;
};

function formatState(state: unknown): string {
  if (state === null || state === undefined) {
    return "—";
  }
  if (
    typeof state === "string" ||
    typeof state === "number" ||
    typeof state === "boolean"
  ) {
    return String(state);
  }
  try {
    return JSON.stringify(state, null, 2);
  } catch {
    return "[unserializable]";
  }
}

function buildRenderEntities(entities: HomePaneEntity[]): RenderEntity[] {
  return entities.map((entity) => ({
    entity,
    formattedState: formatState(entity.state),
  }));
}

export function HomePane({ entities, onToggle, className }: HomePaneProps) {
  const renderEntities = buildRenderEntities(entities);

  return (
    <section className={className ?? "home-pane"}>
      {renderEntities.length === 0 ? (
        <p className="home-pane__empty">No devices registered.</p>
      ) : (
        <ul className="home-pane__list">
          {renderEntities.map(({ entity, formattedState }) => (
            <li className="home-pane__item" key={entity.id}>
              <header className="home-pane__header">
                <span className="home-pane__label">{entity.type}</span>
                <span className="home-pane__id">{entity.id}</span>
              </header>
              <pre className="home-pane__state">{formattedState}</pre>
              {onToggle ? (
                <button
                  className="home-pane__toggle"
                  onClick={() => onToggle(entity.id, entity.state ?? null)}
                  type="button"
                >
                  Toggle
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
