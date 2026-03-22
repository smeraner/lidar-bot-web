import * as Blockly from 'blockly';
import { serialBridge } from './serial';
import type { IBridgeTransport } from './serial';
import { bluetoothBridge } from './bluetooth';
import { lidarStore } from './lidarStore';
import { defineBlocks } from './blockly/blocks';
import { defineGenerators } from './blockly/generator';
import { javascriptGenerator } from 'blockly/javascript';
import { t, setLanguage, getLanguage, type Language } from './i18n';
import { LidarView } from './lidarView';
import './style.css';

defineBlocks();
defineGenerators();

// ── Active bridge transport (shared reference used by Blockly generated code) ──
let activeBridge: IBridgeTransport = serialBridge;
// Expose as `serialBridge` on window so Blockly-generated code works regardless of transport
(window as any).serialBridge = activeBridge;

// === Execution State Management ===
let _isRunning = false;
let _aborted = false;
let _execStartTime = 0;
let _execTimerInterval: ReturnType<typeof setInterval> | null = null;
let _execAutoHideTimeout: ReturnType<typeof setTimeout> | null = null;

function setActiveBridge(bridge: IBridgeTransport) {
  activeBridge = bridge;
  (window as any).serialBridge = bridge;

  // Re-register callbacks on the new transport
  bridge.onLidarData((points) => {
    lidarStore.update(points);
    if (lidarView) {
      lidarView.update(lidarStore.getAllDistances());
    }
    updateUI();
  });

  bridge.onRobotStatus(() => {
    updateUI();
  });
}

let lidarView: LidarView | null = null;

// Register callbacks on initial bridge
serialBridge.onLidarData((points) => {
  lidarStore.update(points);
  if (lidarView) {
    lidarView.update(lidarStore.getAllDistances());
  }
  updateUI();
});

bluetoothBridge.onLidarData((points) => {
  lidarStore.update(points);
  if (lidarView) {
    lidarView.update(lidarStore.getAllDistances());
  }
  updateUI();
});

const toolbox = `
  <xml xmlns="https://developers.google.com/blockly/xml">
    <category name="${t('movement')}" colour="210">
      <block type="lidarbot_move"></block>
      <block type="lidarbot_stop"></block>
    </category>
    <category name="${t('lights')}" colour="290">
      <block type="lidarbot_led_show"></block>
      <block type="lidarbot_set_color"></block>
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

  // ── Consolidated Connection Buttons ──
  const mainConnectBtn = document.getElementById('mainConnectBtn') as HTMLButtonElement;
  const usbDropdownBtn = document.getElementById('connectBtn') as HTMLButtonElement;
  const bleDropdownBtn = document.getElementById('btConnectBtn') as HTMLButtonElement;

  if (mainConnectBtn) {
    if (serialBridge.isConnected || bluetoothBridge.isConnected) {
      mainConnectBtn.textContent = t('disconnect') + " ▾";
      mainConnectBtn.classList.add('connected');
    } else {
      mainConnectBtn.textContent = t('connect') + " ▾";
      mainConnectBtn.classList.remove('connected');
    }
  }

  if (usbDropdownBtn) {
    if (serialBridge.isConnected) {
      usbDropdownBtn.textContent = "🔌 " + t('disconnect'); // or t('bridge_usb') + " " + t('disconnect')
      usbDropdownBtn.classList.add('connected');
    } else {
      usbDropdownBtn.textContent = "🔌 " + t('bridge_usb');
      usbDropdownBtn.classList.remove('connected');
    }
    usbDropdownBtn.classList.toggle('active', activeBridge === serialBridge);
  }

  if (bleDropdownBtn) {
    if (bluetoothBridge.isConnected) {
      bleDropdownBtn.textContent = "🔵 " + t('disconnect_bt'); 
      bleDropdownBtn.classList.add('connected');
    } else {
      bleDropdownBtn.textContent = "🔵 " + t('bridge_bt');
      bleDropdownBtn.classList.remove('connected');
    }
    bleDropdownBtn.classList.toggle('active', activeBridge === bluetoothBridge);
  }

  // Update status indicators — reflect the *active* bridge
  const bridgeStatus = document.getElementById('bridgeStatus');
  if (bridgeStatus) {
    if (activeBridge.isConnected) {
      bridgeStatus.classList.add('connected');
    } else {
      bridgeStatus.classList.remove('connected');
    }
  }

  const robotStatus = document.getElementById('robotStatus');
  const robotStatusText = document.getElementById('robotStatusText');
  if (robotStatus) {
    robotStatus.classList.remove('connected', 'searching', 'disconnected');
    const status = activeBridge.robotStatus;
    robotStatus.classList.add(status);
    
    if (robotStatusText) {
      if (status === 'connected') robotStatusText.textContent = t('robot_connected');
      else if (status === 'searching') robotStatusText.textContent = t('robot_searching');
      else robotStatusText.textContent = t('robot_disconnected');
    }
  }
  
  // Update visibility of Pair button
  const pairBtn = document.getElementById('pairBtn');
  if (pairBtn) {
    if (activeBridge.isConnected && activeBridge.robotStatus !== 'connected') {
      pairBtn.style.display = 'inline-block';
    } else {
      pairBtn.style.display = 'none';
    }
  }

  // Update run button state
  const runBtn = document.getElementById('runBtn') as HTMLButtonElement;
  if (runBtn && !_isRunning) {
    runBtn.disabled = activeBridge.robotStatus !== 'connected';
  }

  // Update document title
  document.title = t('title');

  // Reload toolbox to reflect labels
  workspace.updateToolbox(toolbox);
}

serialBridge.onRobotStatus(() => {
  updateUI();
});

bluetoothBridge.onRobotStatus(() => {
  updateUI();
});

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

// ── Consolidated Connect Logic ──
const mainConnectBtn = document.getElementById('mainConnectBtn') as HTMLButtonElement;
mainConnectBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = mainConnectBtn.parentElement;
    dropdown?.classList.toggle('active');
    updateUI();
});

// Close dropdown when clicking elsewhere
window.addEventListener('click', () => {
  mainConnectBtn?.parentElement?.classList.remove('active');
});

const usbDropdownBtn = document.getElementById('connectBtn') as HTMLButtonElement;
usbDropdownBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!navigator.serial) {
        alert("Web Serial API is not supported in this browser or requires a secure context (HTTPS / localhost).");
        return;
    }
    
    if (serialBridge.isConnected) {
        await serialBridge.disconnect();
    } else {
        // Disconnect BLE if active
        if (bluetoothBridge.isConnected) {
            await bluetoothBridge.disconnect();
        }
        await serialBridge.connect();
        if (serialBridge.isConnected) {
          setActiveBridge(serialBridge);
        }
    }
    // Close dropdown
    mainConnectBtn?.parentElement?.classList.remove('active');
    updateUI();
});

const bleDropdownBtn = document.getElementById('btConnectBtn') as HTMLButtonElement;
bleDropdownBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!navigator.bluetooth) {
        alert("Web Bluetooth API is not supported in this browser or requires a secure context (HTTPS / localhost).");
        return;
    }

    if (bluetoothBridge.isConnected) {
        await bluetoothBridge.disconnect();
    } else {
        // Disconnect USB if active
        if (serialBridge.isConnected) {
            await serialBridge.disconnect();
        }
        await bluetoothBridge.connect();
        if (bluetoothBridge.isConnected) {
          setActiveBridge(bluetoothBridge);
        }
    }
    // Close dropdown
    mainConnectBtn?.parentElement?.classList.remove('active');
    updateUI();
});

document.getElementById('pairBtn')?.addEventListener('click', async () => {
    await activeBridge.pair();
});

document.getElementById('runBtn')?.addEventListener('click', async () => {
  if (_isRunning) return;
  startExecution();

  const code = javascriptGenerator.workspaceToCode(workspace);
  // Expose tools to the eval context
  (window as any).serialBridge = activeBridge;
  (window as any).lidarStore = lidarStore;

  try {
    // Wrap in an async IIFE to support await in generated code
    const AsyncFunction = async function () { }.constructor as any;
    const execute = new AsyncFunction('serialBridge', 'lidarStore', '__checkAbort', '__sleep', code);
    await execute(activeBridge, lidarStore, __checkAbort, __sleep);
    if (!_aborted) {
      finishExecution('finished');
    }
  } catch (e: any) {
    if (e?.message === 'AbortExecution') {
      finishExecution('stopped');
      // Send stop command to ensure the robot halts
      try { await activeBridge.sendCommand(0, 0, 0); } catch {}
    } else {
      console.error("Execution error", e);
      finishExecution('error');
    }
  }
});



function __checkAbort() {
  if (_aborted) throw new Error('AbortExecution');
}
(window as any).__checkAbort = __checkAbort;

function __sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (_aborted) { resolve(); return; }
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      clearInterval(check);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const check = setInterval(() => {
      if (_aborted) done();
    }, 50);
  });
}
(window as any).__sleep = __sleep;

function abortExecution() {
  if (!_isRunning) return;
  _aborted = true;
}

function startExecution() {
  _isRunning = true;
  _aborted = false;
  _execStartTime = Date.now();

  // Clear any pending auto-hide
  if (_execAutoHideTimeout) { clearTimeout(_execAutoHideTimeout); _execAutoHideTimeout = null; }

  // Show execution bar
  const bar = document.getElementById('executionBar');
  if (bar) {
    bar.classList.remove('hidden', 'status-finished', 'status-stopped', 'status-error');
    bar.classList.add('status-running');
  }

  // Update icons and text
  const icon = document.getElementById('execIcon');
  const text = document.getElementById('execText');
  const timer = document.getElementById('execTimer');
  if (icon) icon.textContent = '⏳';
  if (text) text.textContent = t('running_program');
  if (timer) timer.textContent = '0.0s';

  // Start timer
  _execTimerInterval = setInterval(() => {
    if (timer) {
      const elapsed = ((Date.now() - _execStartTime) / 1000).toFixed(1);
      timer.textContent = `${elapsed}s`;
    }
  }, 100);

  // Update buttons
  const runBtn = document.getElementById('runBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stopBtn');
  if (runBtn) runBtn.disabled = true;
  if (stopBtn) stopBtn.style.display = 'inline-flex';

  // Resize Blockly to account for bar height change
  setTimeout(() => Blockly.svgResize(workspace), 400);
}

function finishExecution(status: 'finished' | 'stopped' | 'error') {
  _isRunning = false;
  if (_execTimerInterval) { clearInterval(_execTimerInterval); _execTimerInterval = null; }

  const bar = document.getElementById('executionBar');
  if (bar) {
    bar.classList.remove('status-running', 'status-finished', 'status-stopped', 'status-error');
    bar.classList.add(`status-${status}`);
  }

  const icon = document.getElementById('execIcon');
  const text = document.getElementById('execText');
  if (status === 'finished') {
    if (icon) icon.textContent = '✅';
    if (text) text.textContent = t('program_finished');
  } else if (status === 'stopped') {
    if (icon) icon.textContent = '⏹️';
    if (text) text.textContent = t('program_stopped');
  } else {
    if (icon) icon.textContent = '❌';
    if (text) text.textContent = t('program_error');
  }

  // Restore buttons
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) stopBtn.style.display = 'none';

  updateUI();

  // Auto-hide bar after a few seconds
  _execAutoHideTimeout = setTimeout(() => {
    if (bar && !_isRunning) {
      bar.classList.add('hidden');
      setTimeout(() => Blockly.svgResize(workspace), 400);
    }
  }, 4000);
}

// Stop button handlers (both header button and bar button)
document.getElementById('stopBtn')?.addEventListener('click', () => abortExecution());
document.getElementById('execStopBtn')?.addEventListener('click', () => abortExecution());

// Lidar panel toggle
const lidarToggleBtn = document.getElementById('lidarToggleBtn');
const lidarPanel = document.getElementById('lidarPanel');

lidarToggleBtn?.addEventListener('click', () => {
  if (lidarPanel) {
    const isHidden = lidarPanel.classList.toggle('hidden');
    lidarToggleBtn.classList.toggle('active', !isHidden);
    
    // Initialize LidarView on first show
    if (!isHidden && !lidarView) {
      lidarView = new LidarView('lidarCanvas');
    }
    
    // Resize Blockly workspace after panel toggle transition
    setTimeout(() => {
      Blockly.svgResize(workspace);
      if (lidarView) {
        lidarView.update(lidarStore.getAllDistances());
      }
    }, 350);
  }
});