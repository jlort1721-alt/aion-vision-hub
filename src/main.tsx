import { initSentry } from "./lib/sentry";

// Initialize Sentry before anything else renders
initSentry();

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
