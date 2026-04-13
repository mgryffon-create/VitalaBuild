import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress ResizeObserver loop error (common with UI libraries, doesn't affect functionality)
// This error is benign and occurs when ResizeObserver can't deliver all observations in a single frame
const suppressResizeObserverError = () => {
  const resizeObserverPatterns = [
    "ResizeObserver loop completed with undelivered notifications",
    "ResizeObserver loop limit exceeded",
  ];

  const isResizeObserverError = (msg) =>
    typeof msg === "string" && resizeObserverPatterns.some((p) => msg.includes(p));

  // Suppress in window.onerror
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (isResizeObserverError(message) || (error && isResizeObserverError(error.message))) {
      return true;
    }
    return originalOnError ? originalOnError(message, source, lineno, colno, error) : false;
  };

  // Suppress in error event listener
  window.addEventListener("error", (e) => {
    if (isResizeObserverError(e.message)) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return true;
    }
  });

  // Suppress in unhandledrejection
  window.addEventListener("unhandledrejection", (e) => {
    if (e.reason && isResizeObserverError(e.reason.message)) {
      e.preventDefault();
      return true;
    }
  });
};

suppressResizeObserverError();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
