import * as Blockly from 'blockly';
import { serialBridge } from './serial';
import { defineBlocks } from './blockly/blocks';
import { defineGenerators } from './blockly/generator';
import { javascriptGenerator } from 'blockly/javascript';
import { t, setLanguage, getLanguage, type Language } from './i18n';
import './style.css';

defineBlocks();
defineGenerators();

const toolbox = `
  <xml>
    <block type="lidarbot_move"></block>
    <block type="lidarbot_stop"></block>
  </xml>
`;

const workspace = Blockly.inject('blocklyDiv', {
  toolbox: toolbox
});

// Load saved workspace if any
const savedState = localStorage.getItem('blocklyWorkspace');
if (savedState) {
  try {
    Blockly.serialization.workspaces.load(JSON.parse(savedState), workspace);
  } catch (e) {
    console.error("Error loading workspace state", e);
  }
}

// Auto-save workspace
workspace.addChangeListener((event) => {
  if (event.type === Blockly.Events.BLOCK_CHANGE || 
      event.type === Blockly.Events.BLOCK_CREATE || 
      event.type === Blockly.Events.BLOCK_DELETE || 
      event.type === Blockly.Events.BLOCK_MOVE) {
    const state = Blockly.serialization.workspaces.save(workspace);
    localStorage.setItem('blocklyWorkspace', JSON.stringify(state));
  }
});

function updateUI() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n') as any;
    if (key) {
      el.textContent = t(key);
    }
  });

  // Update dynamic button text based on connection state
  const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;
  if (connectBtn) {
    if (serialBridge.isConnected) {
      connectBtn.innerText = t('connected');
    } else {
      connectBtn.innerText = t('connect');
    }
  }

  // Update document title
  document.title = t('title');

  // Reload toolbox to reflect labels
  workspace.updateToolbox(toolbox);
}

const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
if (languageSelect) {
  languageSelect.value = getLanguage();
  languageSelect.addEventListener('change', (e) => {
    setLanguage((e.target as HTMLSelectElement).value as Language);
    
    // Save current blocks
    const state = Blockly.serialization.workspaces.save(workspace);
    
    // Redefine blocks with new labels
    defineBlocks();
    
    // Clear and reload workspace to force block re-initialization with new labels
    workspace.clear();
    Blockly.serialization.workspaces.load(state, workspace);
    
    updateUI();
  });
}

updateUI();

const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;
connectBtn?.addEventListener('click', async () => {
    if (serialBridge.isConnected) {
        await serialBridge.disconnect();
        updateUI();
        connectBtn.classList.remove('connected');
    } else {
        await serialBridge.connect();
        if (serialBridge.isConnected) {
          updateUI();
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