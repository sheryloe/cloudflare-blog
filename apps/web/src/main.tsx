import React from "react";
import ReactDOM from "react-dom/client";

import "@fontsource-variable/newsreader";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";

import { App } from "./app";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
