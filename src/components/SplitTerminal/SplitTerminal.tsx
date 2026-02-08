import { useEffect, useRef, useState } from "react";
import type { SplitLayout, SplitDirection, SplitPane } from "@/types";
import "./SplitTerminal.css";

interface SplitTerminalViewProps {
  layout: SplitLayout;
  onLayoutChange: (layout: SplitLayout) => void;
  renderTerminal: (paneId: string) => React.ReactNode;
  onSplit: (direction: SplitDirection) => void;
  onClosePane: (paneId: string) => void;
  activePaneId: string;
  onActivatePane: (paneId: string) => void;
}

export function SplitTerminalView({
  layout,
  renderTerminal,
  activePaneId,
  onActivatePane,
  onSplit,
  onClosePane,
}: SplitTerminalViewProps) {
  if (layout.panes.length <= 1) {
    const pane = layout.panes[0];
    if (!pane) return null;
    return (
      <div
        className={`split-pane-container ${pane.id === activePaneId ? "active" : ""}`}
        onClick={() => onActivatePane(pane.id)}
      >
        <div className="split-pane-content">{renderTerminal(pane.id)}</div>
        <div className="split-pane-toolbar">
          <button
            className="split-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSplit("horizontal");
            }}
            title="Split Horizontally"
          >
            ⬌
          </button>
          <button
            className="split-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSplit("vertical");
            }}
            title="Split Vertically"
          >
            ⬍
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`split-container split-${layout.direction}`}>
      {layout.panes.map((pane, index) => (
        <SplitPaneView
          key={pane.id}
          pane={pane}
          isActive={pane.id === activePaneId}
          isLast={index === layout.panes.length - 1}
          direction={layout.direction}
          renderTerminal={renderTerminal}
          onActivate={() => onActivatePane(pane.id)}
          onSplit={onSplit}
          onClose={() => onClosePane(pane.id)}
          canClose={layout.panes.length > 1}
        />
      ))}
    </div>
  );
}

function SplitPaneView({
  pane,
  isActive,
  isLast,
  direction,
  renderTerminal,
  onActivate,
  onSplit,
  onClose,
  canClose,
}: {
  pane: SplitPane;
  isActive: boolean;
  isLast: boolean;
  direction: SplitDirection;
  renderTerminal: (paneId: string) => React.ReactNode;
  onActivate: () => void;
  onSplit: (direction: SplitDirection) => void;
  onClose: () => void;
  canClose: boolean;
}) {
  const dividerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(pane.size);

  useEffect(() => {
    setSize(pane.size);
  }, [pane.size]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startPos = direction === "horizontal" ? e.clientX : e.clientY;
    const startSize = size;

    const onMove = (me: MouseEvent) => {
      const currentPos = direction === "horizontal" ? me.clientX : me.clientY;
      const delta = currentPos - startPos;
      const parent = dividerRef.current?.parentElement;
      if (!parent) return;
      const parentSize = direction === "horizontal" ? parent.offsetWidth : parent.offsetHeight;
      const percentDelta = (delta / parentSize) * 100;
      const newSize = Math.max(15, Math.min(85, startSize + percentDelta));
      setSize(newSize);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <>
      <div
        className={`split-pane ${isActive ? "active" : ""}`}
        style={{
          [direction === "horizontal" ? "width" : "height"]: `${size}%`,
        }}
        onClick={onActivate}
      >
        <div className="split-pane-content">{renderTerminal(pane.id)}</div>
        <div className="split-pane-toolbar">
          <button
            className="split-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSplit("horizontal");
            }}
            title="Split Horizontally"
          >
            ⬌
          </button>
          <button
            className="split-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSplit("vertical");
            }}
            title="Split Vertically"
          >
            ⬍
          </button>
          {canClose && (
            <button
              className="split-btn close"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="Close Pane"
            >
              ×
            </button>
          )}
        </div>
      </div>
      {!isLast && (
        <div
          ref={dividerRef}
          className={`split-divider split-divider-${direction}`}
          onMouseDown={handleDragStart}
        />
      )}
    </>
  );
}
