import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress ResizeObserver loop error (common with UI libraries, doesn't affect functionality)
// This error is benign and occurs when ResizeObserver can't deliver all observations in a single frame
const suppressResizeObserverError = () => {
  const resizeObserverErrMsg = "ResizeObserver loop completed with undelivered notifications.";
  
  // Suppress in window.onerror
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (message === resizeObserverErrMsg || (error && error.message === resizeObserverErrMsg)) {
      return true;
    }
    return originalOnError ? originalOnError(message, source, lineno, colno, error) : false;
  };

  // Suppress in error event listener
  window.addEventListener("error", (e) => {
    if (e.message === resizeObserverErrMsg) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return true;
    }
  });

  // Suppress in unhandledrejection
  window.addEventListener("unhandledrejection", (e) => {
    if (e.reason && e.reason.message === resizeObserverErrMsg) {
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
