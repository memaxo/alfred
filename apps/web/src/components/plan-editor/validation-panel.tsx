/**
 * Validation Panel Component
 *
 * Displays errors and warnings for plan validation.
 */

export interface ValidationPanelProps {
  errors: string[];
  warnings: string[];
}

export function ValidationPanel({ errors, warnings }: ValidationPanelProps) {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="rounded-lg border border-green-700 bg-green-950 p-4">
        <div className="flex items-center gap-2">
          <span className="text-green-500">✓</span>
          <p className="text-green-400 text-sm">Plan is valid</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-700 bg-red-950 p-4">
          <h4 className="mb-2 font-semibold text-red-400 text-sm">
            Errors ({errors.length})
          </h4>
          <ul className="space-y-1">
            {errors.map((error, index) => (
              <li className="text-red-300 text-xs" key={index}>
                • {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-700 bg-yellow-950 p-4">
          <h4 className="mb-2 font-semibold text-sm text-yellow-400">
            Warnings ({warnings.length})
          </h4>
          <ul className="space-y-1">
            {warnings.map((warning, index) => (
              <li className="text-xs text-yellow-300" key={index}>
                • {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
