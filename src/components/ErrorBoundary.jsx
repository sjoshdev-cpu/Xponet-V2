import React from 'react';
import * as Sentry from '@sentry/react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

/**
 * TopLevelErrorBoundary — wraps the entire app.
 * Shows a friendly full-page error screen and logs to console.
 */
export class TopLevelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[Xponet] Unhandled React error:', error, info);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background p-8 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-6 max-w-md text-sm">
          An unexpected error occurred. Reloading the page usually fixes this. If the problem persists, contact support.
        </p>
        {this.state.error && (
          <p className="mb-6 font-mono text-xs text-muted-foreground/70 bg-muted px-3 py-2 rounded max-w-md break-all">
            {String(this.state.error.message || this.state.error)}
          </p>
        )}
        <Button onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    );
  }
}

/**
 * SectionErrorBoundary — lightweight boundary for individual page sections.
 * Shows an inline error card with a "Try again" button that resets the boundary.
 *
 * Props:
 *   name      — human-readable section label, e.g. "Page editor"
 *   resetKey  — when this value changes (e.g. pageId), the boundary auto-resets.
 *               Useful so navigating to a new page always starts with a clean boundary.
 */
export class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, _resetKey: props.resetKey };
  }

  // When the parent passes a new resetKey (e.g. user navigated to a different page),
  // clear the error so children get a fresh mount.
  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state._resetKey) {
      return { hasError: false, error: null, _resetKey: props.resetKey };
    }
    return null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Guard against React StrictMode double-invoke and re-throw loops: only log and
    // report the *first* error caught. Subsequent calls while hasError is already true
    // are redundant re-throws from the retry cycle and should be silently ignored.
    if (this.state.hasError) return;
    console.error(`[Xponet] Section error (${this.props.name || 'unknown'}):`, error, info);
    Sentry.captureException(error, {
      extra: { section: this.props.name, componentStack: info.componentStack },
    });
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  copyStack() {
    const text = this.state.error?.stack || String(this.state.error);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => this._fallbackCopy(text));
    } else {
      this._fallbackCopy(text);
    }
  }

  _fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const label = this.props.name ? `${this.props.name} failed to load` : 'This section failed to load';
    // Only expose raw JS error strings in development builds
    const devMessage = import.meta.env.DEV
      ? String(this.state.error?.message || 'An unexpected error occurred')
      : null;

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[240px] p-8 text-center">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <p className="font-medium mb-1">{label}</p>
        {devMessage && (
          <p className="text-sm text-muted-foreground mb-4">{devMessage}</p>
        )}
        <div className="flex flex-col items-center gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => this.reset()}>
            Try again
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            onClick={() => this.copyStack()}
          >
            Report issue
          </button>
        </div>
      </div>
    );
  }
}
