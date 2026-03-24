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
import { SimulationView } from './simulation';
import ExecutorWorker from './executor.worker?worker';
import './style.css';

defineBlocks();
defineGenerators();

// ── Active bridge transport (shared reference used by Blockly generated code) ──
let activeBridge: IBridgeTransport = serialBridge;
// Expose as `serialBridge` on window so Blockly-generated code works regardless of transport
(window as any).serialBridge = activeBridge;

// === Execution State Management ===
let _isRunning = false;
let _execStartTime = 0;
let _execTimerInterval: ReturnType<typeof setInterval> | null = null;
let _execAutoHideTimeout: ReturnType<typeof setTimeout> | null = null;

let worker: Worker | null = null;
let lidarView: LidarView | null = null;
let simulationView: SimulationView | null = null;

const handleLidarData = (points: { angle: number, distance: number }[]) => {
  lidarStore.update(points);
  if (lidarView) {
    lidarView.update(lidarStore.getAllDistances());
  }
  if (simulationView) {
    simulationView.setLidarData(lidarStore.getAllDistances());
  }
  if (worker) {
    worker.postMessage({ type: 'lidar_update', distances: lidarStore.getAllDistances() });
  }
};

const handleRobotStatus = () => {
  updateUI();
};

function setActiveBridge(bridge: IBridgeTransport) {
  activeBridge = bridge;
  (window as any).serialBridge = bridge;
  updateUI();
}

serialBridge.onLidarData(handleLidarData);
bluetoothBridge.onLidarData(handleLidarData);
serialBridge.onRobotStatus(handleRobotStatus);
bluetoothBridge.onRobotStatus(handleRobotStatus);

const toolbox = `
  <xml xmlns="https://developers.google.com/blockly/xml">
    <category name="${t('movement')}" colour="210">
      <block type="lidarbot_move">
        <value name="SPEED">
          <shadow type="math_number">
            <field name="NUM">50</field>
          </shadow>
        </value>
        <value name="DURATION">
          <shadow type="math_number">
            <field name="NUM">1000</field>
          </shadow>
        </value>
      </block>
      <block type="lidarbot_stop"></block>
    </category>
    <category name="${t('lights')}" colour="290">
      <block type="lidarbot_led_show">
        <value name="DURATION">
          <shadow type="math_number">
            <field name="NUM">1000</field>
          </shadow>
        </value>
      </block>
      <block type="lidarbot_set_color"></block>
    </category>
    <category name="${t('sensing')}" colour="160">
      <block type="lidarbot_get_distance">
        <value name="ANGLE">
          <shadow type="math_number">
            <field name="NUM">0</field>
          </shadow>
        </value>
      </block>
      <block type="lidarbot_is_obstacle">
        <value name="START">
          <shadow type="math_number">
            <field name="NUM">0</field>
          </shadow>
        </value>
        <value name="END">
          <shadow type="math_number">
            <field name="NUM">0</field>
          </shadow>
        </value>
        <value name="THRESHOLD">
          <shadow type="math_number">
            <field name="NUM">200</field>
          </shadow>
        </value>
      </block>
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
  const lang = getLanguage();
  // ── Language / i18n ──
  if ((window as any)._lastUILang !== lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n') as any;
      if (key) {
        const translated = t(key);
        if (el.textContent !== translated) el.textContent = translated;
      }
    });
    // Update toolbox only on language change
    workspace.updateToolbox(toolbox);
    // Update document title
    document.title = t('title');
    (window as any)._lastUILang = lang;
  }

  // ── Consolidated Connection Buttons ──
  const mainConnectBtn = document.getElementById('mainConnectBtn') as HTMLButtonElement;
  const usbDropdownBtn = document.getElementById('connectBtn') as HTMLButtonElement;
  const bleDropdownBtn = document.getElementById('btConnectBtn') as HTMLButtonElement;

  if (mainConnectBtn) {
    const isConnected = serialBridge.isConnected || bluetoothBridge.isConnected;
    const newText = (isConnected ? t('disconnect') : t('connect')) + " ▾";
    if (mainConnectBtn.textContent !== newText) mainConnectBtn.textContent = newText;
    mainConnectBtn.classList.toggle('connected', isConnected);
  }

  if (usbDropdownBtn) {
    const isConnected = serialBridge.isConnected;
    const newText = isConnected ? "🔌 " + t('disconnect') : "🔌 " + t('bridge_usb');
    if (usbDropdownBtn.textContent !== newText) usbDropdownBtn.textContent = newText;
    usbDropdownBtn.classList.toggle('connected', isConnected);
    usbDropdownBtn.classList.toggle('active', activeBridge === serialBridge);
  }

  if (bleDropdownBtn) {
    const isConnected = bluetoothBridge.isConnected;
    const newText = isConnected ? "🔵 " + t('disconnect_bt') : "🔵 " + t('bridge_bt');
    if (bleDropdownBtn.textContent !== newText) bleDropdownBtn.textContent = newText;
    bleDropdownBtn.classList.toggle('connected', isConnected);
    bleDropdownBtn.classList.toggle('active', activeBridge === bluetoothBridge);
  }

  // Update status indicators — reflect the *active* bridge
  const bridgeStatus = document.getElementById('bridgeStatus');
  if (bridgeStatus) {
    bridgeStatus.classList.toggle('connected', activeBridge.isConnected);
  }

  const robotStatus = document.getElementById('robotStatus');
  const robotStatusText = document.getElementById('robotStatusText');
  if (robotStatus) {
    const status = activeBridge.robotStatus;
    robotStatus.classList.remove('connected', 'searching', 'disconnected');
    robotStatus.classList.add(status);
    
    if (robotStatusText) {
      const statusLabel = status === 'connected' ? t('robot_connected') : 
                          (status === 'searching' ? t('robot_searching') : t('robot_disconnected'));
      if (robotStatusText.textContent !== statusLabel) robotStatusText.textContent = statusLabel;
    }
  }
  
  // Update visibility of Pair button
  const pairBtn = document.getElementById('pairBtn');
  if (pairBtn) {
    const newDisplay = (activeBridge.isConnected && activeBridge.robotStatus !== 'connected') ? 'inline-block' : 'none';
    if (pairBtn.style.display !== newDisplay) pairBtn.style.display = newDisplay;
  }

  // Update run buttons state
  if (!_isRunning) {
    const runLiveBtn = document.getElementById('runLiveBtn') as HTMLButtonElement;
    if (runLiveBtn) runLiveBtn.disabled = activeBridge.robotStatus !== 'connected';
    const runSimBtn = document.getElementById('runSimBtn') as HTMLButtonElement;
    if (runSimBtn) runSimBtn.disabled = false;
  }
}

const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
if (languageSelect) {
  languageSelect.value = getLanguage();
  languageSelect.addEventListener('change', (e) => {
    setLanguage((e.target as HTMLSelectElement).value as Language);
    
    const state = Blockly.serialization.workspaces.save(workspace);
    defineBlocks();
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
        if (bluetoothBridge.isConnected) {
            await bluetoothBridge.disconnect();
        }
        await serialBridge.connect();
        if (serialBridge.isConnected) {
          setActiveBridge(serialBridge);
        }
    }
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
        if (serialBridge.isConnected) {
            await serialBridge.disconnect();
        }
        await bluetoothBridge.connect();
        if (bluetoothBridge.isConnected) {
          setActiveBridge(bluetoothBridge);
        }
    }
    mainConnectBtn?.parentElement?.classList.remove('active');
    updateUI();
});

document.getElementById('pairBtn')?.addEventListener('click', async () => {
    await activeBridge.pair();
});

let _isLiveRun = false;

async function runProgram(isLive: boolean) {
  if (_isRunning) return;
  _isLiveRun = isLive;

  // Initialize simulation view if needed
  if (!simulationView) {
    simulationView = new SimulationView('simulationCanvas');
  }

  // Always reset simulation for a new run
  simulationView.reset();

  startExecution();

  const code = javascriptGenerator.workspaceToCode(workspace);

  if (worker) worker.terminate();
  worker = new ExecutorWorker();

  worker.onmessage = async (e) => {
      const msg = e.data;
      if (msg.type === 'sendCommand') {
          console.log("Main: Received sendCommand from worker", msg.args);
          // Forward to real robot only if live
          if (_isLiveRun) {
            await (activeBridge.sendCommand as any)(...msg.args);
          }
          // Always forward to simulation
          if (simulationView) {
            simulationView.updateCommand(...(msg.args as [number, number, number, number]));
          } else {
            console.warn("Main: simulationView is not initialized");
          }
      } else if (msg.type === 'sendLedShow') {
          if (_isLiveRun) await activeBridge.sendLedShow();
          if (simulationView) {
            simulationView.ledShow();
          }
      } else if (msg.type === 'sendLedColor') {
          if (_isLiveRun) await (activeBridge.sendLedColor as any)(...msg.args);
          if (simulationView) {
            simulationView.setLedColor(...(msg.args as [number, number, number]));
          }
      } else if (msg.type === 'highlightBlock') {
          workspace.highlightBlock(msg.id);
      } else if (msg.type === 'finished') {
          if (_isLiveRun) try { await activeBridge.sendCommand(0, 0, 0); } catch {}
          finishExecution('finished');
      } else if (msg.type === 'stopped') {
          if (_isLiveRun) try { await activeBridge.sendCommand(0, 0, 0); } catch {}
          finishExecution('stopped');
      } else if (msg.type === 'error') {
          console.error("Worker error:", msg.error);
          if (_isLiveRun) try { await activeBridge.sendCommand(0, 0, 0); } catch {}
          finishExecution('error');
      }
  };

  worker.postMessage({ type: 'lidar_update', distances: lidarStore.getAllDistances() });
  worker.postMessage({ type: 'run', code });
}
document.getElementById('runLiveBtn')?.addEventListener('click', () => runProgram(true));
document.getElementById('runSimBtn')?.addEventListener('click', () => runProgram(false));

function abortExecution() {
  if (!_isRunning) return;
  if (worker) {
      worker.postMessage({ type: 'abort' });
  }
}

function startExecution() {
  _isRunning = true;
  _execStartTime = Date.now();

  if (_execAutoHideTimeout) { clearTimeout(_execAutoHideTimeout); _execAutoHideTimeout = null; }

  const bar = document.getElementById('executionBar');
  if (bar) {
    bar.classList.remove('hidden', 'status-finished', 'status-stopped', 'status-error');
    bar.classList.add('status-running');
  }

  const icon = document.getElementById('execIcon');
  const text = document.getElementById('execText');
  const timer = document.getElementById('execTimer');
  if (icon) icon.textContent = '⏳';
  if (text) text.textContent = _isLiveRun ? t('running_program') : t('run_sim');
  if (timer) timer.textContent = '0.0s';

  _execTimerInterval = setInterval(() => {
    if (timer) {
      const elapsed = ((Date.now() - _execStartTime) / 1000).toFixed(1);
      timer.textContent = `${elapsed}s`;
    }
  }, 100);

  const runLiveBtn = document.getElementById('runLiveBtn') as HTMLButtonElement;
  const runSimBtn = document.getElementById('runSimBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stopBtn');
  if (runLiveBtn) runLiveBtn.disabled = true;
  if (runSimBtn) runSimBtn.disabled = true;
  if (stopBtn) stopBtn.style.display = 'inline-flex';

  setTimeout(() => Blockly.svgResize(workspace), 400);
}

function finishExecution(status: 'finished' | 'stopped' | 'error') {
  _isRunning = false;
  if (_execTimerInterval) { clearInterval(_execTimerInterval); _execTimerInterval = null; }
  workspace.highlightBlock(null);

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

  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) stopBtn.style.display = 'none';

  updateUI();

  _execAutoHideTimeout = setTimeout(() => {
    if (bar && !_isRunning) {
      bar.classList.add('hidden');
      setTimeout(() => Blockly.svgResize(workspace), 400);
    }
  }, 4000);
}

document.getElementById('stopBtn')?.addEventListener('click', () => abortExecution());
document.getElementById('execStopBtn')?.addEventListener('click', () => abortExecution());

// ── Sidebar Management ──
const sidebarRight = document.getElementById('sidebarRight');
const trayButtons = {
  sim: document.getElementById('simToggleBtn') as HTMLButtonElement,
  lidar: document.getElementById('lidarToggleBtn') as HTMLButtonElement
};
const panels = {
  sim: document.getElementById('simulationPanel'),
  lidar: document.getElementById('lidarPanel')
};

let activePanel: 'sim' | 'lidar' | null = null;

function togglePanel(panel: 'sim' | 'lidar') {
  if (activePanel === panel) {
    // Collapse
    activePanel = null;
    sidebarRight?.classList.add('collapsed');
  } else {
    // Expand or Switch
    activePanel = panel;
    sidebarRight?.classList.remove('collapsed');
    
    // Lazy init views
    if (panel === 'sim' && !simulationView) {
      simulationView = new SimulationView('simulationCanvas');
    }
    if (panel === 'lidar' && !lidarView) {
      lidarView = new LidarView('lidarCanvas');
    }
  }

  // Update UI
  Object.entries(trayButtons).forEach(([key, btn]) => {
    btn?.classList.toggle('active', activePanel === key);
  });
  Object.entries(panels).forEach(([key, p]) => {
    p?.classList.toggle('hidden', activePanel !== key);
  });

  // Resize Blockly
  setTimeout(() => {
    Blockly.svgResize(workspace);
    if (simulationView) (simulationView as any).resize();
    if (lidarView) (lidarView as any).resize();
  }, 300);
}

trayButtons.sim?.addEventListener('click', () => togglePanel('sim'));
trayButtons.lidar?.addEventListener('click', () => togglePanel('lidar'));

document.getElementById('resetSimBtn')?.addEventListener('click', () => {
  simulationView?.reset();
});

document.getElementById('addObstacleBtn')?.addEventListener('click', () => {
  simulationView?.addObstacle();
});

// Auto-expand sidebar on large screens
if (window.innerWidth >= 1200) {
  togglePanel('sim');
}

// Virtual Lidar Loop
let lastSimDistances: number[] = [];
function virtualLidarLoop() {
  if (simulationView && !activeBridge.isConnected) {
    const distances = simulationView.getVirtualLidarData();
    
    // Only update if distances changed significantly
    const distSum = distances.reduce((a, b) => a + b, 0);
    const lastDistSum = lastSimDistances.reduce((a, b) => a + b, 0);
    
    if (distSum !== lastDistSum) {
      lastSimDistances = [...distances];
      const points = distances.map((d, i) => ({ angle: i, distance: d }));
      lidarStore.update(points);
      
      if (lidarView) {
        lidarView.update(distances);
      }
      if (simulationView) {
        simulationView.setLidarData(distances);
      }
      if (worker) {
        worker.postMessage({ type: 'lidar_update', distances });
      }
    }
    updateUI(); // Still call to update connection status etc
  }
  setTimeout(virtualLidarLoop, 100); // 10Hz is enough for Lidar
}
virtualLidarLoop();