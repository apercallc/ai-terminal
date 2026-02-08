import type { CommandStep } from "@/types";
import { analyzeCommand, getRiskColor, getRiskLabel } from "@/lib/safety/detector";
import "./ApprovalModal.css";

interface ApprovalModalProps {
  step: CommandStep;
  stepIndex: number;
  totalSteps: number;
  planSummary: string;
  onApprove: () => void;
  onReject: () => void;
  onApproveAll: () => void;
}

export function ApprovalModal({
  step,
  stepIndex,
  totalSteps,
  planSummary,
  onApprove,
  onReject,
  onApproveAll,
}: ApprovalModalProps) {
  const analysis = analyzeCommand(step.command);
  const effectiveRisk =
    ["high", "critical"].indexOf(analysis.riskLevel) >
    ["high", "critical"].indexOf(step.riskLevel)
      ? analysis.riskLevel
      : step.riskLevel;

  return (
    <div className="approval-overlay">
      <div className="approval-modal">
        <div className="approval-header">
          <h3>Command Approval</h3>
          <span className="approval-step-badge">
            Step {stepIndex + 1} of {totalSteps}
          </span>
        </div>

        {stepIndex === 0 && planSummary && (
          <div className="approval-plan-summary">
            <strong>Plan:</strong> {planSummary}
          </div>
        )}

        <div className="approval-body">
          <div className="approval-command">
            <label>Command</label>
            <pre>
              <code>{step.command}</code>
            </pre>
          </div>

          <div className="approval-description">
            <label>What this does</label>
            <p>{step.description}</p>
          </div>

          <div className="approval-expected">
            <label>Expected outcome</label>
            <p>{step.expectedOutcome}</p>
          </div>

          <div className="approval-risk">
            <label>Risk Level</label>
            <div className="risk-badge-row">
              <span
                className="risk-badge"
                style={{
                  backgroundColor: getRiskColor(effectiveRisk) + "20",
                  color: getRiskColor(effectiveRisk),
                  borderColor: getRiskColor(effectiveRisk),
                }}
              >
                {getRiskLabel(effectiveRisk)}
              </span>
              {analysis.reasons
                .filter((r) => r !== "No known risks detected")
                .map((reason, i) => (
                  <span key={i} className="risk-reason">
                    {reason}
                  </span>
                ))}
            </div>
          </div>

          {step.rollback && (
            <div className="approval-rollback">
              <label>Rollback command</label>
              <pre>
                <code>{step.rollback}</code>
              </pre>
            </div>
          )}

          {analysis.isBlacklisted && (
            <div className="approval-warning">
              ⚠️ This command is <strong>blacklisted</strong> and should not be executed.
            </div>
          )}
        </div>

        <div className="approval-actions">
          <button
            className="approval-btn btn-reject"
            onClick={onReject}
          >
            Reject
          </button>
          <button
            className="approval-btn btn-approve-all"
            onClick={onApproveAll}
            title="Switch to auto-accept for remaining steps"
          >
            Approve All
          </button>
          <button
            className="approval-btn btn-approve"
            onClick={onApprove}
            disabled={analysis.isBlacklisted}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
