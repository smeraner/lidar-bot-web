import * as Blockly from 'blockly';
import 'blockly/blocks';
import { serialBridge } from './serial';
import type { IBridgeTransport } from './serial';
import { bluetoothBridge } from './bluetooth';
import { lidarStore } from './lidarStore';
import { defineBlocks } from './blockly/blocks';
import { defineGenerators } from './blockly/generator';
import { t } from './i18n';
import { UIManager } from './ui';
import { runProgram, emergencyStop, worker, isRunning } from './execution';
import { Toast } from './toast';
import './style.css';
import { registerSW } from 'virtual:pwa-register';

defineBlocks();
defineGenerators();

let activeBridge: IBridgeTransport = serialBridge;
(window as any).serialBridge = activeBridge;

const getToolbox = () => `
  <xml xmlns="https://developers.google.com/blockly/xml">
    <category name="${t('movement')}" colour="210">
      <block type="lidarbot_move">
        <value name="SPEED"><shadow type="math_number"><field name="NUM">50</field></shadow></value>
        <value name="DURATION"><shadow type="math_number"><field name="NUM">1000</field></shadow></value>
      </block>
      <block type="lidarbot_rotate">
        <value name="SPEED"><shadow type="math_number"><field name="NUM">50</field></shadow></value>
        <value name="DURATION"><shadow type="math_number"><field name="NUM">1000</field></shadow></value>
      </block>
      <block type="lidarbot_stop"></block>
    </category>
    <category name="${t('lights')}" colour="290">
      <block type="lidarbot_led_show"></block>
      <block type="lidarbot_led_blink">
        <value name="DURATION"><shadow type="math_number"><field name="NUM">1000</field></shadow></value>
      </block>
      <block type="lidarbot_set_color"></block>
    </category>
    <category name="${t('sensing')}" colour="160">
      <block type="lidarbot_get_distance">
        <value name="ANGLE"><shadow type="math_angle"><field name="NUM">0</field></shadow></value>
      </block>
      <block type="lidarbot_is_obstacle">
        <value name="START"><shadow type="math_angle"><field name="NUM">315</field></shadow></value>
        <value name="END"><shadow type="math_angle"><field name="NUM">45</field></shadow></value>
        <value name="THRESHOLD"><shadow type="math_number"><field name="NUM">200</field></shadow></value>
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
        <value name="TIMES"><shadow type="math_number"><field name="NUM">10</field></shadow></value>
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
  toolbox: getToolbox(),
  move: {
    scrollbars: {
      horizontal: true,
      vertical: true,
    },
    drag: true,
    wheel: true,
  },
  zoom: {
    controls: true,
    wheel: true,
    startScale: 1.0,
    maxScale: 3,
    minScale: 0.3,
    scaleSpeed: 1.2,
    pinch: true,
  },
  trashcan: true,
});

// Ensure Blockly handles its initial size correctly
setTimeout(() => {
  Blockly.svgResize(workspace);
}, 100);

const savedState = localStorage.getItem('blocklyWorkspace');
if (savedState) {
  try {
    Blockly.serialization.workspaces.load(JSON.parse(savedState), workspace);
  } catch (e) {
    console.error('Error loading workspace state', e);
  }
}

workspace.addChangeListener((event) => {
  if (
    event.type === Blockly.Events.BLOCK_CHANGE ||
    event.type === Blockly.Events.BLOCK_CREATE ||
    event.type === Blockly.Events.BLOCK_DELETE ||
    event.type === Blockly.Events.BLOCK_MOVE
  ) {
    const state = Blockly.serialization.workspaces.save(workspace);
    localStorage.setItem('blocklyWorkspace', JSON.stringify(state));
  }
});

const uiManager = new UIManager(
  workspace,
  () => activeBridge,
  (b: IBridgeTransport) => {
    activeBridge = b;
    (window as any).serialBridge = b;
  },
  () => isRunning,
  getToolbox,
);

const handleLidarData = (rawPoints: { angle: number; distance: number }[]) => {
  // Translate Hardware Coordinate System (0=Right) to Web Logical (0=Front) + 7° mount offset
  const points = rawPoints.map((p) => ({
    angle: Math.round(p.angle + 97) % 360,
    distance: p.distance,
  }));

  lidarStore.update(points);
  if (uiManager.lidarView) {
    uiManager.lidarView.update(lidarStore.getAllDistances());
  }
  if (uiManager.simulationView) {
    uiManager.simulationView.setLidarData(lidarStore.getAllDistances());
  }
  if (worker) {
    worker.postMessage({ type: 'lidar_update', distances: lidarStore.getAllDistances() });
  }
};

const handleImuData = (pitch: number, roll: number, yaw: number) => {
  lidarStore.updateImu(pitch, roll, yaw);
};

const handleRobotStatus = (status: 'connected' | 'disconnected' | 'searching') => {
  if (status === 'connected') {
    Toast.success(t('robot_connected'));
  } else if (status === 'disconnected') {
    Toast.error(t('robot_disconnected'));
    if (isRunning) {
      emergencyStop(activeBridge, workspace, () => uiManager.updateUI());
    }
  }
  uiManager.updateUI();
};

serialBridge.onLidarData(handleLidarData);
bluetoothBridge.onLidarData(handleLidarData);
serialBridge.onImuData(handleImuData);
bluetoothBridge.onImuData(handleImuData);
serialBridge.onRobotStatus(handleRobotStatus);
bluetoothBridge.onRobotStatus(handleRobotStatus);

window.addEventListener('virtual_lidar_data', ((e: CustomEvent) => {
  const distances = e.detail.distances;
  const points = distances.map((d: number, i: number) => ({ angle: i, distance: d }));
  lidarStore.update(points);
  if (uiManager.lidarView) uiManager.lidarView.update(distances);
  if (uiManager.simulationView) uiManager.simulationView.setLidarData(distances);
  if (worker) worker.postMessage({ type: 'lidar_update', distances });
}) as EventListener);

uiManager.initListeners();
uiManager.updateUI();

document.getElementById('runBtn')?.addEventListener('click', () => {
  const isLive = activeBridge.robotStatus === 'connected';
  runProgram(isLive, workspace, activeBridge, uiManager.simulationView, () => uiManager.updateUI());
});
document
  .getElementById('eStopBtn')
  ?.addEventListener('click', () =>
    emergencyStop(activeBridge, workspace, () => uiManager.updateUI()),
  );
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.code === 'Space') {
    if (
      document.activeElement?.tagName !== 'INPUT' &&
      document.activeElement?.tagName !== 'TEXTAREA'
    ) {
      e.preventDefault();
      emergencyStop(activeBridge, workspace, () => uiManager.updateUI());
    }
  }
});

// PWA Installation handling
let deferredPrompt: any;
const installBtn = document.getElementById('installPwaBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) {
    installBtn.style.display = 'block';
  }
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });
}

// PWA Update handling
const updateSW = registerSW({
  onNeedRefresh() {
    Toast.show(t('update_available') || 'New version available!', 'info', 0, {
      label: t('refresh') || 'Refresh',
      callback: () => updateSW(true),
    });
  },
  onOfflineReady() {
    Toast.success(t('offline_ready') || 'App ready to work offline');
  },
});

// Periodic update check (every hour)
setInterval(
  () => {
    updateSW();
  },
  60 * 60 * 1000,
);
