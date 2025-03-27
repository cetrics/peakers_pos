import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/static/dist/", // Set the base URL path for assets
  build: {
    outDir: "../static/dist", // Output assets to static/dist
    emptyOutDir: true, // Clear the folder before each build
    chunkSizeWarningLimit: 1500, // Set a higher chunk size limit (optional)
    rollupOptions: {
      input: {
        main: "src/main.jsx", // Vite's entry point
      },
      optimizeDeps: {
        include: ["jspdf", "jspdf-autotable"],
      },
      output: {
        // Ensure no hashing in filenames
        entryFileNames: "assets/[name].js", // Static JS filenames
        chunkFileNames: "assets/[name].js", // Static chunk filenames
        assetFileNames: "assets/[name][extname]", // Static asset filenames

        // Manual chunks for optimized code splitting
        manualChunks: {
          "react-vendor": ["react", "react-dom"], // React-related vendor chunk
          utility: ["lodash", "moment"], // Utility libraries chunk
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000", // Flask backend
        changeOrigin: true,
      },
    },
  },
});
