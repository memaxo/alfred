import {
  type AutonomyLevel,
  AutonomySlider,
} from "@/components/autonomy-slider";

export type PreferencesStepProps = {
  autonomy: AutonomyLevel;
  onAutonomyChange: (value: AutonomyLevel) => void;
};

export function PreferencesStep({
  autonomy,
  onAutonomyChange,
}: PreferencesStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <h2 className="font-bold text-2xl text-biolum tracking-tighter">
          Set Your Preferences
        </h2>
        <p className="text-biolum-dim">
          Configure how ALFRED operates. You can change these anytime in
          Settings.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-void-surface/40 p-8 backdrop-blur-xl">
        <AutonomySlider onChange={onAutonomyChange} value={autonomy} />
      </div>

      <div className="space-y-3 text-biolum-dim text-sm">
        <p>
          <span className="font-medium text-biolum">Autonomy Level</span>{" "}
          controls how much independence ALFRED has when executing tasks.
        </p>
        <ul className="space-y-2 pl-4">
          <li>
            • <span className="text-biolum">Read-only:</span> No actions, only
            information
          </li>
          <li>
            • <span className="text-biolum">Low:</span> Ask before each action
          </li>
          <li>
            • <span className="text-biolum">Medium:</span> Ask for risky actions
            only
          </li>
          <li>
            • <span className="text-biolum">High:</span> Execute autonomously
            with supervision
          </li>
        </ul>
      </div>
    </div>
  );
}
