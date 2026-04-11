import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import ExecutorWorker from './executor.worker?worker';
import { t } from './i18n';
import { lidarStore } from './lidarStore';
import type { IBridgeTransport } from './serial';
import type { SimulationView } from './simulation';

export let isRunning = false;
export let isLiveRun = false;
export let worker: Worker | null = null;

let execStartTime = 0;
let execTimerInterval: ReturnType<typeof setInterval> | null = null;
let execAutoHideTimeout: ReturnType<typeof setTimeout> | null = null;

export function initWorker() {
  if (worker) worker.terminate();
  worker = new ExecutorWorker();
}

export function startExecution(workspace: Blockly.WorkspaceSvg, isLive: boolean) {
  isRunning = true;
  execStartTime = Date.now();
  if (execAutoHideTimeout) {
    clearTimeout(execAutoHideTimeout);
    execAutoHideTimeout = null;
  }
  const bar = document.getElementById('executionBar');
  if (bar) {
    bar.classList.remove('hidden', 'status-finished', 'status-stopped', 'status-error');
    bar.classList.add('status-running');
  }
  const icon = document.getElementById('execIcon');
  const text = document.getElementById('execText');
  const timer = document.getElementById('execTimer');
  if (icon) icon.textContent = '⏳';
  if (text) text.textContent = isLive ? t('running_program') : t('run_sim');
  if (timer) timer.textContent = '0.0s';

  execTimerInterval = setInterval(() => {
    if (timer) {
      const elapsed = ((Date.now() - execStartTime) / 1000).toFixed(1);
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

export function finishExecution(
  status: 'finished' | 'stopped' | 'error',
  workspace: Blockly.WorkspaceSvg,
  updateUIFn: () => void,
) {
  isRunning = false;
  if (execTimerInterval) {
    clearInterval(execTimerInterval);
    execTimerInterval = null;
  }
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
  updateUIFn();

  execAutoHideTimeout = setTimeout(() => {
    if (bar && !isRunning) {
      bar.classList.add('hidden');
      setTimeout(() => Blockly.svgResize(workspace), 400);
    }
  }, 4000);
}

export async function abortExecution() {
  if (!isRunning) return;
  if (worker) worker.postMessage({ type: 'abort' });
}

export async function emergencyStop(
  activeBridge: IBridgeTransport,
  workspace: Blockly.WorkspaceSvg,
  updateUIFn: () => void,
) {
  console.warn('🚨 EMERGENCY STOP TRIGGERED 🚨');
  if (worker) {
    worker.terminate();
    worker = null;
  }
  isRunning = false;
  finishExecution('stopped', workspace, updateUIFn);
  try {
    await activeBridge.sendCommand(0, 0, 0, 0);
  } catch (e) {
    console.error('E-Stop failed:', e);
  }
}

export async function runProgram(
  isLive: boolean,
  workspace: Blockly.WorkspaceSvg,
  activeBridge: IBridgeTransport,
  simulationView: SimulationView | null,
  updateUIFn: () => void,
) {
  if (isRunning) return;
  isLiveRun = isLive;

  if (simulationView) simulationView.reset();

  startExecution(workspace, isLive);
  const code = javascriptGenerator.workspaceToCode(workspace);
  initWorker();

  if (worker) {
    worker.onmessage = async (e) => {
      const msg = e.data;
      if (msg.type === 'sendCommand') {
        if (isLiveRun && activeBridge.isConnected)
          await (activeBridge.sendCommand as any)(...msg.args);
        if (simulationView)
          simulationView.updateCommand(...(msg.args as [number, number, number, number]));
      } else if (msg.type === 'sendLedShow') {
        if (isLiveRun && activeBridge.isConnected) await activeBridge.sendLedShow();
        if (simulationView) simulationView.ledShow();
      } else if (msg.type === 'sendLedColor') {
        if (isLiveRun && activeBridge.isConnected)
          await (activeBridge.sendLedColor as any)(...msg.args);
        if (simulationView) simulationView.setLedColor(...(msg.args as [number, number, number]));
      } else if (msg.type === 'highlightBlock') {
        workspace.highlightBlock(msg.id);
      } else if (msg.type === 'finished') {
        if (isLiveRun && activeBridge.isConnected) await activeBridge.sendCommand(0, 0, 0);
        finishExecution('finished', workspace, updateUIFn);
      } else if (msg.type === 'stopped') {
        if (isLiveRun && activeBridge.isConnected) await activeBridge.sendCommand(0, 0, 0);
        finishExecution('stopped', workspace, updateUIFn);
      } else if (msg.type === 'error') {
        console.error('Worker error:', msg.error);
        if (isLiveRun && activeBridge.isConnected) await activeBridge.sendCommand(0, 0, 0);
        finishExecution('error', workspace, updateUIFn);
      }
    };
    worker.postMessage({ type: 'lidar_update', distances: lidarStore.getAllDistances() });
    worker.postMessage({ type: 'run', code });
  }
}
