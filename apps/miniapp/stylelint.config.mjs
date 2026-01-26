import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const stylelint = require("stylelint");
const standardConfig = require("stylelint-config-standard");
const supportedRules = new Set(Object.keys(stylelint.rules));
const filterRules = (rules = {}) =>
  Object.fromEntries(Object.entries(rules).filter(([name]) => supportedRules.has(name)));

/** @type {import('stylelint').Config} */
export default {
  ignoreFiles: ["src/styles/tailwind.generated.css"],
  rules: {
    ...filterRules(standardConfig.rules),
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: ["tailwind", "apply", "layer", "variants", "responsive", "screen"],
      },
    ],
    "selector-class-pattern": [
      "^([a-z][a-z0-9]*)(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$",
      { message: "Expected class selector to be kebab-case or BEM." },
    ],
  },
};
