---
description: How to perform the automated/manual web application testing after implementation.
---

# Web Testing Workflow

Follow these steps to ensure the `webapp` is functional after any changes:

// turbo
1. **Automated Unit Tests**:
   Run the Vitest test suite to ensure no core logic regressions occurred.
   ```powershell
   npm run test
   ```
   Ensure tests pass before proceeding to UI validation.

2. **Start Dev Server**:
   Check if `npm run dev` is already running. If NOT, start it in the `webapp/` directory:
   ```powershell
   cd webapp
   npm run dev
   ```

3. **Launch Browser**:
   Use `browser_subagent` to open `http://localhost:5173`.

4. **Verify Blockly Workspace**:
   - Verify `#blocklyDiv` is visible.
   - Verify toolbox contains `lidarbot_move` and `lidarbot_stop` blocks.

5. **Verify UI/I18n**:
   - Verify "Connect" button exists.
   - If language selector is present, toggle and verify translations update.
   - Ensure NO browser console errors.

6. **Code Generation Test**:
   - Use `browser_subagent` to drag a `lidarbot_move` block.
   - Click "#runBtn".
   - Verify console log for `serialBridge.sendCommand` call.
   - **Capture a screenshot** and include it in your final report.
