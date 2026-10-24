import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { createWorkspaceAliases } from '../../../config/workspace-aliases.ts';
export default defineConfig({ root: fileURLToPath(new URL('.', import.meta.url)), plugins: [vue()], resolve: { alias: { ...createWorkspaceAliases(import.meta.url), vue: fileURLToPath(new URL('../../../node_modules/vue/dist/vue.esm-bundler.js', import.meta.url)) } }, build: { outDir: process.env.COST_BROWSER_DIST ?? '/tmp/affino-cost-audit/browser-dist', emptyOutDir: true, sourcemap: true }, server: { host: '127.0.0.1', port: 4190 }, preview: { host: '127.0.0.1', port: 4190 } });
