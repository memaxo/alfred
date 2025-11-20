import { AutonomySlider, type AutonomyLevel } from "@/components/autonomy-slider";

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
      <div className="text-center space-y-3">
        <h2 className="text-biolum tracking-tighter text-2xl font-bold">
          Set Your Preferences
        </h2>
        <p className="text-biolum-dim">
          Configure how ALFRED operates. You can change these anytime in Settings.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl p-8">
        <AutonomySlider value={autonomy} onChange={onAutonomyChange} />
      </div>

      <div className="space-y-3 text-sm text-biolum-dim">
        <p>
          <span className="text-biolum font-medium">Autonomy Level</span> controls how much 
          independence ALFRED has when executing tasks.
        </p>
        <ul className="space-y-2 pl-4">
          <li>• <span className="text-biolum">Read-only:</span> No actions, only information</li>
          <li>• <span className="text-biolum">Low:</span> Ask before each action</li>
          <li>• <span className="text-biolum">Medium:</span> Ask for risky actions only</li>
          <li>• <span className="text-biolum">High:</span> Execute autonomously with supervision</li>
        </ul>
      </div>
    </div>
  );
}

