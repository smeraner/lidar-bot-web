import * as Blockly from 'blockly';
import { t, getLanguage, setLanguage, type Language } from './i18n';
import type { IBridgeTransport } from './serial';
import { serialBridge } from './serial';
import { bluetoothBridge } from './bluetooth';
import { Toast } from './toast';
import { LidarView } from './lidarView';
import { SimulationView } from './simulation';
import { defineBlocks } from './blockly/blocks';

export class UIManager {
  public lidarView: LidarView | null = null;
  public simulationView: SimulationView | null = null;
  private activePanel: 'sim' | 'lidar' | null = null;

  private workspace: Blockly.WorkspaceSvg;
  private getActiveBridge: () => IBridgeTransport;
  private setActiveBridge: (b: IBridgeTransport) => void;
  private getIsRunning: () => boolean;
  private getToolbox: () => string;

  constructor(
    workspace: Blockly.WorkspaceSvg,
    getActiveBridge: () => IBridgeTransport,
    setActiveBridge: (b: IBridgeTransport) => void,
    getIsRunning: () => boolean,
    getToolbox: () => string,
  ) {
    this.workspace = workspace;
    this.getActiveBridge = getActiveBridge;
    this.setActiveBridge = setActiveBridge;
    this.getIsRunning = getIsRunning;
    this.getToolbox = getToolbox;
  }

  public updateUI() {
    const lang = getLanguage();
    const activeBridge = this.getActiveBridge();
    const isRunning = this.getIsRunning();

    if ((window as any)._lastUILang !== lang) {
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n') as any;
        if (key) {
          const translated = t(key);
          if (el.textContent !== translated) el.textContent = translated;
        }
      });
      this.workspace.updateToolbox(this.getToolbox());
      document.title = t('title');
      (window as any)._lastUILang = lang;
    }

    const mainConnectBtn = document.getElementById('mainConnectBtn') as HTMLButtonElement;
    const usbDropdownBtn = document.getElementById('connectBtn') as HTMLButtonElement;
    const bleDropdownBtn = document.getElementById('btConnectBtn') as HTMLButtonElement;

    if (mainConnectBtn) {
      const isConnected = serialBridge.isConnected || bluetoothBridge.isConnected;
      const newText = (isConnected ? t('disconnect') : t('connect')) + ' ▾';
      if (mainConnectBtn.textContent !== newText) mainConnectBtn.textContent = newText;
      mainConnectBtn.classList.toggle('connected', isConnected);
    }

    if (usbDropdownBtn) {
      const isConnected = serialBridge.isConnected;
      const newText = isConnected ? '🔌 ' + t('disconnect') : '🔌 ' + t('bridge_usb');
      if (usbDropdownBtn.textContent !== newText) usbDropdownBtn.textContent = newText;
      usbDropdownBtn.classList.toggle('connected', isConnected);
      usbDropdownBtn.classList.toggle('active', activeBridge === serialBridge);
    }

    if (bleDropdownBtn) {
      const isConnected = bluetoothBridge.isConnected;
      const newText = isConnected ? '🔵 ' + t('disconnect_bt') : '🔵 ' + t('bridge_bt');
      if (bleDropdownBtn.textContent !== newText) bleDropdownBtn.textContent = newText;
      bleDropdownBtn.classList.toggle('connected', isConnected);
      bleDropdownBtn.classList.toggle('active', activeBridge === bluetoothBridge);
    }

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
        const statusLabel =
          status === 'connected'
            ? t('robot_connected')
            : status === 'searching'
              ? t('robot_searching')
              : t('robot_disconnected');
        if (robotStatusText.textContent !== statusLabel) robotStatusText.textContent = statusLabel;
      }
    }

    const pairBtn = document.getElementById('pairBtn');
    if (pairBtn) {
      const newDisplay =
        activeBridge.isConnected && activeBridge.robotStatus !== 'connected'
          ? 'inline-block'
          : 'none';
      if (pairBtn.style.display !== newDisplay) pairBtn.style.display = newDisplay;
    }

    if (!isRunning) {
      const runLiveBtn = document.getElementById('runLiveBtn') as HTMLButtonElement;
      if (runLiveBtn) runLiveBtn.disabled = activeBridge.robotStatus !== 'connected';
      const runSimBtn = document.getElementById('runSimBtn') as HTMLButtonElement;
      if (runSimBtn) runSimBtn.disabled = false;
    }
  }

  public initListeners() {
    const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
    if (languageSelect) {
      languageSelect.value = getLanguage();
      languageSelect.addEventListener('change', (e) => {
        setLanguage((e.target as HTMLSelectElement).value as Language);
        const state = Blockly.serialization.workspaces.save(this.workspace);
        defineBlocks();
        this.workspace.clear();
        Blockly.serialization.workspaces.load(state, this.workspace);
        this.updateUI();
      });
    }

    const mainConnectBtn = document.getElementById('mainConnectBtn') as HTMLButtonElement;
    mainConnectBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      mainConnectBtn.parentElement?.classList.toggle('active');
      this.updateUI();
    });

    window.addEventListener('click', () => {
      mainConnectBtn?.parentElement?.classList.remove('active');
    });

    document.getElementById('connectBtn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!navigator.serial) {
        Toast.error('Web Serial API is not supported in this browser.');
        return;
      }
      if (serialBridge.isConnected) {
        await serialBridge.disconnect();
      } else {
        if (bluetoothBridge.isConnected) await bluetoothBridge.disconnect();
        await serialBridge.connect();
        if (serialBridge.isConnected) this.setActiveBridge(serialBridge);
      }
      mainConnectBtn?.parentElement?.classList.remove('active');
      this.updateUI();
    });

    document.getElementById('btConnectBtn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!navigator.bluetooth) {
        Toast.error('Web Bluetooth API is not supported in this browser.');
        return;
      }
      if (bluetoothBridge.isConnected) {
        await bluetoothBridge.disconnect();
      } else {
        if (serialBridge.isConnected) await serialBridge.disconnect();
        await bluetoothBridge.connect();
        if (bluetoothBridge.isConnected) this.setActiveBridge(bluetoothBridge);
      }
      mainConnectBtn?.parentElement?.classList.remove('active');
      this.updateUI();
    });

    document
      .getElementById('pairBtn')
      ?.addEventListener('click', () => this.getActiveBridge().pair());

    // Sidebar Resizing
    const sidebarRight = document.getElementById('sidebarRight');
    const resizer = document.getElementById('sidebarResizer');

    if (resizer && sidebarRight) {
      let isResizing = false;
      resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => {
        if (!isResizing || !sidebarRight) return;
        const newWidth = window.innerWidth - e.clientX;
        const clampedWidth = Math.min(Math.max(newWidth, 200), window.innerWidth - 100);
        sidebarRight.style.width = `${clampedWidth}px`;
        sidebarRight.classList.remove('collapsed');
        this.activePanel = this.activePanel || 'sim';
        if (this.simulationView) (this.simulationView as any).resize();
        if (this.lidarView) (this.lidarView as any).resize();
        Blockly.svgResize(this.workspace);
      });
      window.addEventListener('mouseup', () => {
        if (isResizing) {
          isResizing = false;
          resizer?.classList.remove('resizing');
          document.body.style.cursor = '';
        }
      });
    }

    const trayButtons = {
      sim: document.getElementById('simToggleBtn') as HTMLButtonElement,
      lidar: document.getElementById('lidarToggleBtn') as HTMLButtonElement,
    };
    const panels = {
      sim: document.getElementById('simulationPanel'),
      lidar: document.getElementById('lidarPanel'),
    };

    const togglePanel = (panel: 'sim' | 'lidar') => {
      if (this.activePanel === panel) {
        this.activePanel = null;
        sidebarRight?.classList.add('collapsed');
      } else {
        this.activePanel = panel;
        sidebarRight?.classList.remove('collapsed');
        if (panel === 'sim' && !this.simulationView) {
          this.simulationView = new SimulationView('simulationCanvas');
        }
        if (panel === 'lidar' && !this.lidarView) {
          this.lidarView = new LidarView('lidarCanvas');
        }
      }
      Object.entries(trayButtons).forEach(([key, btn]) =>
        btn?.classList.toggle('active', this.activePanel === key),
      );
      Object.entries(panels).forEach(([key, p]) =>
        p?.classList.toggle('hidden', this.activePanel !== key),
      );
      setTimeout(() => {
        Blockly.svgResize(this.workspace);
        if (this.simulationView) (this.simulationView as any).resize();
        if (this.lidarView) (this.lidarView as any).resize();
      }, 300);
    };

    trayButtons.sim?.addEventListener('click', () => togglePanel('sim'));
    trayButtons.lidar?.addEventListener('click', () => togglePanel('lidar'));

    document
      .getElementById('resetSimBtn')
      ?.addEventListener('click', () => this.simulationView?.reset());
    const addObstacleMenuBtn = document.getElementById('addObstacleMenuBtn');
    addObstacleMenuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      addObstacleMenuBtn.parentElement?.classList.toggle('active');
    });
    window.addEventListener('click', () => {
      addObstacleMenuBtn?.parentElement?.classList.remove('active');
    });

    document.getElementById('addCircleBtn')?.addEventListener('click', () => {
      this.simulationView?.addObstacle('circle');
    });
    document.getElementById('addRectBtn')?.addEventListener('click', () => {
      this.simulationView?.addObstacle('rect');
    });

    if (window.innerWidth >= 1200) togglePanel('sim');

    // Virtual Lidar Loop
    let lastSimDistances: number[] = [];
    const virtualLidarLoop = () => {
      const bridge = this.getActiveBridge();
      if (this.simulationView && !bridge.isConnected) {
        const distances = this.simulationView.getVirtualLidarData();
        const distSum = distances.reduce((a, b) => a + b, 0);
        const lastDistSum = lastSimDistances.reduce((a, b) => a + b, 0);
        if (distSum !== lastDistSum) {
          lastSimDistances = [...distances];
          // We dispatch this back up via a custom event or callback, or just call directly since we import it
          // Actually it's cleaner to dispatch an event, but let's just do it here to save time
          const event = new CustomEvent('virtual_lidar_data', { detail: { distances } });
          window.dispatchEvent(event);
        }
        this.updateUI();
      }
      setTimeout(virtualLidarLoop, 100);
    };
    virtualLidarLoop();
  }
}
