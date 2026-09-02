// @agentforge/cli — interactive prompts using only Node's built-in readline.
// No external dependencies. Supports text input, numbered selection, and
// yes/no confirmation.

import readline from "node:readline";
import { stdin, stdout } from "node:process";

// ── Internal helpers ──────────────────────────────────────────

/**
 * Create a readline interface tied to stdin/stdout.
 * @returns {readline.Interface}
 */
function createRL() {
  return readline.createInterface({
    input: stdin,
    output: stdout,
    terminal: stdout.isTTY,
  });
}

/**
 * Prompt for a free-text answer.
 * @param {string} question
 * @param {object} [opts]
 * @param {string|undefined} [opts.default] - default value if user presses Enter
 * @param {function(string): string|null} [opts.validate] - returns error string or null
 * @returns {Promise<string>}
 */
export function ask(question, opts = {}) {
  const { default: defaultValue, validate } = opts;
  return new Promise((resolve) => {
    const rl = createRL();

    const suffix = defaultValue ? ` (${defaultValue})` : "";
    const promptText = `${question}${suffix}: `;

    const askOnce = () => {
      rl.question(promptText, (answer) => {
        const value = (answer || defaultValue || "").trim();

        if (validate) {
          const error = validate(value);
          if (error) {
            stdout.write(`  ✗ ${error}\n`);
            askOnce();
            return;
          }
        }
        rl.close();
        resolve(value);
      });
    };

    askOnce();
  });
}

/**
 * Present a numbered list and let the user pick one.
 * @param {string} title - header text printed before the list
 * @param {Array<{label: string, description?: string, value: *}>} choices
 * @returns {Promise<*>} the selected choice's `value`
 */
export function select(title, choices) {
  return new Promise((resolve) => {
    stdout.write(`\n${title}\n`);
    choices.forEach((c, i) => {
      const num = `${i + 1}.`.padStart(4);
      if (c.description) {
        stdout.write(`  ${num}  ${c.label}\n`);
        stdout.write(`         ${c.description}\n`);
      } else {
        stdout.write(`  ${num}  ${c.label}\n`);
      }
    });

    const rl = createRL();
    const askOnce = () => {
      rl.question(`\n  Select [1-${choices.length}]: `, (answer) => {
        const idx = parseInt(answer.trim(), 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= choices.length) {
          stdout.write(
            `  ✗ Please enter a number between 1 and ${choices.length}.\n`
          );
          askOnce();
          return;
        }
        rl.close();
        resolve(choices[idx].value);
      });
    };
    askOnce();
  });
}

/**
 * Yes/no confirmation prompt.
 * @param {string} question
 * @param {boolean} [defaultYes=false]
 * @returns {Promise<boolean>}
 */
export function confirm(question, defaultYes = false) {
  const hint = defaultYes ? "Y/n" : "y/N";
  return new Promise((resolve) => {
    const rl = createRL();
    rl.question(`${question} [${hint}]: `, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === "") {
        resolve(defaultYes);
      } else {
        resolve(a === "y" || a === "yes");
      }
    });
  });
}

/**
 * Print an informational line (no prompt).
 * @param {string} text
 */
export function info(text) {
  stdout.write(`${text}\n`);
}

/**
 * Print a success line.
 * @param {string} text
 */
export function success(text) {
  stdout.write(`\n  ✓ ${text}\n`);
}

/**
 * Print an error line.
 * @param {string} text
 */
export function error(text) {
  stdout.write(`\n  ✗ ${text}\n`);
}
