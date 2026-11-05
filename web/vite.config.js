import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages serves the site from /<repository-name>/; set BASE_PATH when building elsewhere.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/europe-democracy-dashboard/',
  plugins: [svelte()],
});
