---
name: CodeQualityAuditor
description: Ensures future software quality and consistency in LidarBotWeb.
---

# CodeQualityAuditor Skill

This skill provides guidelines and audits for maintaining and improving the LidarBotWeb codebase.

## 📈 Quality Guidelines

### 1. Web Serial Robustness
- **Error Handling**: Always wrap `navigator.serial.requestPort()` and `port.open()` in `try-catch` blocks.
- **Connection Checks**: Before sending a command, verify the `writer` is not null.
- **Buffer Management**: Use a `TextEncoderStream` for reliable UTF-8 outgoing messages.

### 2. Blockly Generator Best Practices
- **Async Execution**: Generated code MUST use `await` for commands that effect physical motion.
- **Delays**: Ensure adequate pauses between motor commands (default 1000ms is recommended for PoC, unless otherwise specified).
- **Cleanup**: Always include a `lidarbot_stop` call (`0,0,0`) in terminal/initial states.

### 3. I18n and UI Quality
- **Language Support**: All UI strings should be managed via `webapp/src/i18n.ts`. Use `t('key')` for translation.
- **Responsiveness**: Ensure the `blocklyDiv` fills the available screen space while leaving room for the control buttons.

## 🛠 Project Conventions
- **Naming**: Use camelCase for TypeScript variables/functions and snake_case for C++ variables (shared structs).
- **Types**: Always use explicit types for Serial parameters and Blockly block states.
- **Documentation**: Keep `readme.md` updated with any protocol changes.

## 🧪 Testing & Automation Workflows
Before concluding any feature implementation, ensure you utilize the following automated pipelines and scripts:

- **Web Tests:** Run `npm run test` in the `webapp` directory (powered by Vitest).
- **Web Linting:** Run `npm run lint` and `npm run format` (powered by ESLint + Prettier).
- **Firmware Checks:** Run `npm run lint-firmware` at the project root to run Cppcheck via PlatformIO.
- **Pre-commit:** Note that `husky` and `lint-staged` are active and will run formatting and testing automatically on commit.

Refer to the following workflows in `.agent/workflows/` for manual testing:
- **[/web-testing](file:///d:/Projekte/LidarBotWeb/.agent/workflows/web-testing.md)**: Steps for validating the Web Serial connection, Blockly workspace, and code generation.
- **[/firmware-upload](file:///d:/Projekte/LidarBotWeb/.agent/workflows/firmware-upload.md)**: Steps for building, flashing, and verifying the ESP32 bridge firmware.

## 🔍 Pre-Submission Checklist
- [ ] Do automated tests pass (`npm run test`)?
- [ ] Are there zero linting errors (`npm run lint`)?
- [ ] Are all serial commands terminated with `\n`?
- [ ] Does the `webapp` handle serial disconnection gracefully?
- [ ] Is the Blockly toolbox categorized for easy navigation?
- [ ] Is the `struct_message` identical in both `firmware` and `webapp` generators?
- [ ] Has the `/web-testing` workflow been completed successfully?
