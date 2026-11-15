import React from "react";
import ReactDOM from "react-dom/client";
import { App, ErrorBoundary } from "@/app/App";
import { repository } from "@/db/repository";
import "@/styles/index.css";
import "@/styles/redesign.css";
import "@/features/meal-planning/meals.css";
import "@/features/shopping/shopping.css";
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <div className="startup" role="status">
    Cargando Balance Familiar…
  </div>,
);
repository
  .initialize()
  .then(() =>
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    ),
  )
  .catch((error) => {
    function Failure(): React.ReactNode {
      throw error;
    }
    root.render(
      <ErrorBoundary>
        <Failure />
      </ErrorBoundary>,
    );
  });
