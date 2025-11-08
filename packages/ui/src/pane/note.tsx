export type NotePaneItem = {
  id: string;
  title?: string | null;
  content: string;
  createdAt?: string | null;
};

export type NotePaneProps = {
  items: NotePaneItem[];
  onDelete?: (id: string) => void;
  className?: string;
};

type RenderItem = {
  item: NotePaneItem;
  formattedTimestamp: string | null;
};

function buildRenderItems(items: NotePaneItem[]): RenderItem[] {
  return items.map((item) => {
    const formattedTimestamp =
      item.createdAt !== undefined && item.createdAt !== null
        ? new Date(item.createdAt).toLocaleString()
        : null;
    return {
      item,
      formattedTimestamp,
    };
  });
}

export function NotePane({ items, onDelete, className }: NotePaneProps) {
  const renderItems = buildRenderItems(items);

  return (
    <section className={className ?? "note-pane"}>
      {renderItems.length === 0 ? (
        <p className="note-pane__empty">No notes yet.</p>
      ) : (
        <ul className="note-pane__list">
          {renderItems.map(({ item, formattedTimestamp }) => (
            <li className="note-pane__item" key={item.id}>
              <header className="note-pane__header">
                <h3 className="note-pane__title">
                  {item.title ?? "Untitled note"}
                </h3>
                {formattedTimestamp ? (
                  <time
                    className="note-pane__timestamp"
                    dateTime={item.createdAt ?? undefined}
                  >
                    {formattedTimestamp}
                  </time>
                ) : null}
              </header>
              <p className="note-pane__content">{item.content}</p>
              {onDelete ? (
                <button
                  className="note-pane__delete"
                  onClick={() => onDelete(item.id)}
                  type="button"
                >
                  Delete
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
