import { createRoot } from "react-dom/client";
import { App } from "./App";

const favicon = document.createElement("link");
favicon.rel = "icon";
favicon.type = "image/svg+xml";
favicon.href = new URL(
  "../../../assets/brand/netsentry-mark.svg",
  import.meta.url,
).href;
document.head.append(favicon);

const root = document.getElementById("root");
if (!root) throw new Error("NetSentry could not find its application root.");
createRoot(root).render(<App />);
