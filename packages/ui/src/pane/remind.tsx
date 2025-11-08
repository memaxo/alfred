export type RemindPaneItem = {
  id: string;
  title: string;
  dueAt: string;
  description?: string | null;
};

export type RemindPaneProps = {
  items: RemindPaneItem[];
  onDelete?: (id: string) => void;
  className?: string;
};

type RenderItem = {
  item: RemindPaneItem;
  formattedDueAt: string;
};

function buildRenderItems(items: RemindPaneItem[]): RenderItem[] {
  return items.map((item) => {
    const formattedDueAt = new Date(item.dueAt).toLocaleString();
    return {
      item,
      formattedDueAt,
    };
  });
}

export function RemindPane({ items, onDelete, className }: RemindPaneProps) {
  const renderItems = buildRenderItems(items);

  return (
    <section className={className ?? "remind-pane"}>
      {renderItems.length === 0 ? (
        <p className="remind-pane__empty">No reminders scheduled.</p>
      ) : (
        <ul className="remind-pane__list">
          {renderItems.map(({ item, formattedDueAt }) => (
            <li className="remind-pane__item" key={item.id}>
              <header className="remind-pane__header">
                <h3 className="remind-pane__title">{item.title}</h3>
                <time className="remind-pane__due" dateTime={item.dueAt}>
                  {formattedDueAt}
                </time>
              </header>
              {item.description ? (
                <p className="remind-pane__description">{item.description}</p>
              ) : null}
              {onDelete ? (
                <button
                  className="remind-pane__delete"
                  onClick={() => onDelete(item.id)}
                  type="button"
                >
                  Dismiss
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
