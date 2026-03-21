---
description: How to perform the automated/manual web application testing after implementation.
---

# Web Testing Workflow

Follow these steps to ensure the `webapp` is functional after any changes:

1. **Start Dev Server**:
   Ensure `npm run dev` is running in the `webapp/` directory. By default, it runs on `http://localhost:5173`.
   
2. **Launch Browser**:
   Use the `browser_subagent` to open `http://localhost:5173`.

3. **Verify Blockly Workspace**:
   - Confirm that the `#blocklyDiv` is visible and contains SVG elements.
   - Look for the default toolbox (with `lidarbot_move` and `lidarbot_stop` blocks).

4. **Test Connection Logic**:
   - Check if the "Connect" button (`#connectBtn`) is present.
   - (Note: Web Serial API needs a real user gesture and a compatible browser, so automated tests might just verify the button exists and triggers `requestPort`).

5. **Verify UI/I18n**:
   - If a language selector is present, toggle between English and German and verify translations update.
   - Check that no "Uncaught Error" messages appear in the browser console.

6. **Block Code Generation Test**:
   - Drag a `lidarbot_move` block to the workspace.
   - Click the "Run" button (`#runBtn`).
   - Check the `console.log` output to ensure `serialBridge.sendCommand(...)` is being called with the expected values.
