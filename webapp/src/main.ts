import * as Blockly from 'blockly';
import { serialBridge } from './serial';
import { defineBlocks } from './blockly/blocks';
import { defineGenerators } from './blockly/generator';
import { javascriptGenerator } from 'blockly/javascript';
import './style.css';

defineBlocks();
defineGenerators();

const workspace = Blockly.inject('blocklyDiv', {
  toolbox: `
    <xml>
      <block type="lidarbot_move"></block>
      <block type="lidarbot_stop"></block>
    </xml>
  `
});

const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;
connectBtn?.addEventListener('click', async () => {
    if (serialBridge.isConnected) {
        await serialBridge.disconnect();
        connectBtn.innerText = 'Connect LidarBot';
        connectBtn.classList.remove('connected');
    } else {
        await serialBridge.connect();
        if (serialBridge.isConnected) {
          connectBtn.innerText = 'Connected';
          connectBtn.classList.add('connected');
        }
    }
});

document.getElementById('runBtn')?.addEventListener('click', async () => {
  const code = javascriptGenerator.workspaceToCode(workspace);
  // Expose serialBridge to the eval context
  (window as any).serialBridge = serialBridge;

  try {
    // Wrap in an async IIFE to support await in generated code
    const AsyncFunction = async function () { }.constructor as any;
    const execute = new AsyncFunction(code);
    await execute();
  } catch (e) {
    console.error("Execution error", e);
  }
});