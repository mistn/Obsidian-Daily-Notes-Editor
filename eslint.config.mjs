import js from "@eslint/js";
import globals from "globals";
import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: [
            "node_modules/**",
            "build/**",
            // build output, not source
            "main.js",
            "main.js.map",
            "*.zip",
            ".hotreload",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...svelte.configs["flat/recommended"],
    {
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            // TypeScript already reports undefined identifiers, and Svelte
            // templates look up names the parser cannot see. Keeping this on
            // only produced ~100 false positives.
            "no-undef": "off",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-empty-function": "off",
            "no-prototype-builtins": "off",
            "prefer-const": "warn",
            // Heuristic rule: it cannot see guard clauses such as
            // `if (rendered) return;` or async callbacks, so it fires on
            // almost every imperative state update in this view. The reactive
            // statements here are guarded by `appliedSettingsVersion`.
            "svelte/infinite-reactive-loop": "off",
        },
    },
    {
        // Let eslint-plugin-svelte hand <script lang="ts"> blocks to tseslint
        files: ["**/*.svelte"],
        languageOptions: {
            parserOptions: {
                parser: tseslint.parser,
            },
        },
    },
    {
        files: ["**/*.mjs", "*.config.mjs"],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    }
);
