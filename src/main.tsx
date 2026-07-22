import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import "./index.css";

Amplify.configure(outputs);

void import("./App")
  .then(({ default: App }) => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error("Application bootstrap failed.", error);

    const root = document.getElementById("root");
    if (root) {
      root.textContent = "アプリケーションの起動に失敗しました。";
    }
  });