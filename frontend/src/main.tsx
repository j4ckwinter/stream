import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { getAdvice } from "./api";
import { getDemoAdvice } from "./demo";
import "./styles.css";

const demo = import.meta.env.MODE === "demo";
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <StrictMode>
    <App getAdvice={demo ? getDemoAdvice : getAdvice} demo={demo} />
  </StrictMode>,
);
