import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { Component } from "react";

// We need to test the ErrorBoundary from App.tsx, so we recreate it here
// since it's not exported separately. This tests the exact same logic.
import type { ReactNode, ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-destructive text-lg font-semibold">
            Something went wrong
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// A component that throws an error on render
function ThrowingComponent({ message }: { message: string }): React.JSX.Element {
  throw new Error(message);
}

// A component that can be toggled to throw
let shouldThrow = false;
function ConditionallyThrowingComponent() {
  if (shouldThrow) throw new Error("Conditional error");
  return <div>Content is working</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    shouldThrow = false;
    // Suppress console.error for expected errors
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders fallback UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Test crash" />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test crash")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent message="fail" />
      </ErrorBoundary>
    );
    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("shows generic message when error has no message", () => {
    function ThrowEmptyError(): React.JSX.Element {
      throw new Error("");
    }
    render(
      <ErrorBoundary>
        <ThrowEmptyError />
      </ErrorBoundary>
    );
    expect(
      screen.getByText("An unexpected error occurred.")
    ).toBeInTheDocument();
  });

  it("recovers when 'Try again' is clicked and children no longer throw", () => {
    shouldThrow = true;

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionallyThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Fix the child component
    shouldThrow = false;

    // Click try again to reset the boundary
    fireEvent.click(screen.getByText("Try again"));

    expect(screen.getByText("Content is working")).toBeInTheDocument();
    expect(
      screen.queryByText("Something went wrong")
    ).not.toBeInTheDocument();
  });

  it("calls componentDidCatch with error info", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent message="Catch test" />
      </ErrorBoundary>
    );

    // componentDidCatch should have been called
    expect(consoleSpy).toHaveBeenCalledWith(
      "[ErrorBoundary]",
      expect.any(Error),
      expect.any(String)
    );
  });

  it("contains the original error message in the display", () => {
    const longMessage = "Database connection timeout after 30 seconds";
    render(
      <ErrorBoundary>
        <ThrowingComponent message={longMessage} />
      </ErrorBoundary>
    );
    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });
});
