import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    nodePolyfills({
      // Specific modules that should not be polyfilled.
      exclude: [],
      // Whether to polyfill specific globals.
      globals: {
        Buffer: true, // can also be 'build', 'dev', or false
        global: true,
        process: true,
      },
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
});
