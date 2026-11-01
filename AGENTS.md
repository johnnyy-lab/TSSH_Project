# Agent Execution Rules & Guidelines

## 0. Absolute Rule: Language (天條：語言)

The language rule takes priority over every other section of this file, and over the model's default reasoning language.

All output text must use Traditional Chinese (Taiwan idioms, 繁體中文). This includes, but is not limited to:

- On-screen thinking summaries
- Internal thinking, reasoning, and analysis
- Replies, plans, progress updates, and error explanations given to the user
- The main body of commit messages
- All human-readable text written into project files (including problem descriptions and repair records in `AGYRules/agenttodo.md`, the titles, explanations, key points, and terminal text of slides and notebooks, and documentation)

Produce these texts directly in Traditional Chinese. Do not conceive them in English first and then translate. If an English sentence appears, stop immediately, rewrite from that sentence into Traditional Chinese, and continue.
Code, commands, paths, filenames, identifiers, function names, original error text, proper nouns, and general technical terms stay in English. Chinese and English may be mixed.
When starting a sub-agent, the first line of the prompt given to it must be: `全程使用繁體中文。`

## 1. Reproduce First (嚴禁無依據猜測)

- **Zero Assumption Policy**: Do NOT edit any source code based on intuition or textual bug descriptions.
- **Capture Runtime Evidence**: You must first run reproduction scripts, test suites (e.g., `pytest`, `npm test`), or curl commands via CLI.
- **Mandatory Failure Log**: Obtain and analyze the explicit failure logs and stack traces before drafting any fix.

## 2. Minimal Surface Area (最小改動原則)

- **Targeted Edits Only**: Restrict changes strictly to lines necessary to fix the root cause.
- **No Unsolicited Refactoring**: Do NOT refactor surrounding functions, rename variables, or alter code styling unless explicitly requested.
- **Self-Inspection**: Review changes with `git diff` before declaring completion to ensure no unexpected modifications.

## 3. Verification & Definition of Done (完成定義與驗收)

- **Deterministic Done**: A task is complete ONLY when the original reproduction command or test passes cleanly (Exit code 0), with no regressions introduced.
- **Concrete Evidence**: Always provide terminal output logs as proof of resolution. Never conclude with just "I have fixed the issue" without verification evidence.
