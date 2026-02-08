import "./OnboardingModal.css";

interface OnboardingModalProps {
  onSetup: () => void;
  onSkip: () => void;
}

export function OnboardingModal({ onSetup, onSkip }: OnboardingModalProps) {
  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true">
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <h3>Set up AI</h3>
        </div>

        <div className="onboarding-body">
          <p>
            To use AI features, add an API key in Settings. If you skip this step, AI features will
            stay disabled and AI Terminal will work like a regular terminal.
          </p>
        </div>

        <div className="onboarding-actions">
          <button className="onboarding-btn btn-skip" onClick={onSkip} type="button">
            Skip for now
          </button>
          <button className="onboarding-btn btn-setup" onClick={onSetup} type="button">
            Open Settings
          </button>
        </div>
      </div>
    </div>
  );
}
