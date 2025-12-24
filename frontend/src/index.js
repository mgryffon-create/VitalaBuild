import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress ResizeObserver loop error (common with UI libraries, doesn't affect functionality)
const resizeObserverError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  if (message === "ResizeObserver loop completed with undelivered notifications.") {
    return true; // Suppress this specific error
  }
  return resizeObserverError ? resizeObserverError(message, source, lineno, colno, error) : false;
};

// Also handle it in the error event
window.addEventListener("error", (e) => {
  if (e.message === "ResizeObserver loop completed with undelivered notifications.") {
    e.stopImmediatePropagation();
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
