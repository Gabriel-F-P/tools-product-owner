/// <reference types="vite/client" />

import type { CSSProperties } from "react";

// Logo animada da TNA (web component carregado por /tna-logo.js).
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "tna-logo": {
        variant?: "full" | "symbol";
        animate?: "hover" | "loop" | "none";
        intro?: boolean;
        descriptor?: "pt" | "en" | "none";
        accent?: string;
        ink?: string;
        speed?: number;
        style?: CSSProperties;
      };
    }
  }
}
