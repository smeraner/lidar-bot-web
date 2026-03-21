import * as Blockly from 'blockly';
import { serialBridge } from './serial';
import { lidarStore } from './lidarStore';
import { defineBlocks } from './blockly/blocks';
import { defineGenerators } from './blockly/generator';
import { javascriptGenerator } from 'blockly/javascript';
import { t, setLanguage, getLanguage, type Language } from './i18n';
import './style.css';

defineBlocks();
defineGenerators();

serialBridge.onLidarData((points) => {
  lidarStore.update(points);
});

const toolbox = `
  <xml xmlns="https://developers.google.com/blockly/xml">
    <category name="${t('movement')}" colour="210">
      <block type="lidarbot_move"></block>
      <block type="lidarbot_stop"></block>
    </category>
    <category name="${t('lights')}" colour="290">
      <block type="lidarbot_led_show"></block>
    </category>
    <category name="${t('sensing')}" colour="160">
      <block type="lidarbot_get_distance"></block>
      <block type="lidarbot_is_obstacle"></block>
    </category>
    <category name="${t('logic')}" colour="210">
      <block type="controls_if"></block>
      <block type="logic_compare"></block>
      <block type="logic_operation"></block>
      <block type="logic_boolean"></block>
    </category>
    <category name="${t('loops')}" colour="120">
      <block type="controls_repeat_ext">
        <value name="TIMES">
          <shadow type="math_number">
            <field name="NUM">10</field>
          </shadow>
        </value>
      </block>
      <block type="controls_whileUntil"></block>
    </category>
    <category name="${t('math')}" colour="230">
      <block type="math_number"></block>
      <block type="math_arithmetic"></block>
    </category>
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
  // Expose tools to the eval context
  (window as any).serialBridge = serialBridge;
  (window as any).lidarStore = lidarStore;

  try {
    // Wrap in an async IIFE to support await in generated code
    const AsyncFunction = async function () { }.constructor as any;
    const execute = new AsyncFunction(code);
    await execute();
  } catch (e) {
    console.error("Execution error", e);
  }
});