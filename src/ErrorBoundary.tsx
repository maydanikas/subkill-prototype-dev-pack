import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { detectLocale } from "./i18n/detect";
import { translate } from "./i18n/format";

type Props = { children: ReactNode };
type State = { error: string | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error: error.message || String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const locale = detectLocale();
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#00FF88", padding: 24, fontFamily: "sans-serif" }}>
        <div style={{ color: "#fff", fontSize: 18, marginBottom: 8 }}>{translate(locale, "crashed")}</div>
        <pre style={{ whiteSpace: "pre-wrap", color: "#FF3B30", fontSize: 13 }}>{this.state.error}</pre>
      </div>
    );
  }
}
