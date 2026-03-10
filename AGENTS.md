# Repository Guidelines

## Project Structure & Module Organization

This repository is a `pnpm` monorepo. Put product-specific code in `apps/` and reusable logic in `packages/`.

- `apps/web`: main Vue 3 + Vite editor, browser extension entrypoints, and UI components.
- `apps/vscode`: VS Code extension built with webpack.
- `apps/utools`: uTools packaging assets.
- `packages/core`: Markdown rendering, theme injection, and extension logic.
- `packages/shared`: shared configs, editor helpers, constants, types, and utilities.
- `packages/config`: shared TypeScript config presets.
- `docs/`, `public/`, `scripts/`, `docker/`: documentation, static assets, release scripts, and container builds.

## Build, Test, and Development Commands

Use Node `>=22.16.0` and `pnpm`.

- `pnpm install`: install workspace dependencies.
- `pnpm start` or `pnpm web dev`: run the web editor locally at Vite dev server defaults.
- `pnpm lint`: run ESLint with `--fix` across the repo.
- `pnpm type-check`: run `vue-tsc --build --force`.
- `pnpm web build`: build the main web app.
- `pnpm web ext:dev`: start the browser extension dev flow.
- `pnpm utools:package`: package the uTools plugin.

## Coding Style & Naming Conventions

Write TypeScript and Vue SFCs with the existing ESLint setup in [`eslint.config.mjs`](/Users/sunny/Documents/project/ai/md-codex/eslint.config.mjs). The repo uses Antfu's config, no semicolons, and formatter integration through ESLint. Follow existing naming patterns: Vue components in `PascalCase.vue`, utility modules in `camelCase.ts`, and package names under the `@md/*` scope. Keep shared code in `packages/*` instead of duplicating logic inside apps.

## Testing Guidelines

There is no dedicated automated test suite in the current tree. Treat `pnpm lint`, `pnpm type-check`, and the relevant app build as the minimum validation for every change. For UI or extension work, include manual verification steps in your PR, such as `pnpm web dev` or `pnpm web ext:dev`.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commits, for example `fix: ...`, `chore: ...`, and `build(deps): ...`. Keep commits focused and descriptive; use scopes when they add clarity, such as `feat(editor): add shortcut setting`. PRs should explain motivation, summarize behavior changes, link related issues, and include screenshots or GIFs for visible UI changes. Update docs when commands, configuration, or user-facing behavior changes.
