import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initCrashReporter } from "@/lib/analytics/crash-reporter";

initCrashReporter();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
