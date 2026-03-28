let _aborted = false;
let _distances: number[] = new Array(360).fill(0);

self.onmessage = async (e) => {
  if (e.data.type === 'abort') {
    _aborted = true;
  } else if (e.data.type === 'lidar_update') {
    _distances = e.data.distances;
  } else if (e.data.type === 'run') {
    _aborted = false;
    const code = e.data.code;

    const serialBridge = {
      sendCommand: async (x: number, y: number, z: number, duration: number = 0) => {
        self.postMessage({ type: 'sendCommand', args: [x, y, z, duration] });
        await __sleep(10); // yield
      },
      sendLedShow: async () => {
        self.postMessage({ type: 'sendLedShow' });
        await __sleep(10);
      },
      sendLedColor: async (r: number, g: number, b: number) => {
        self.postMessage({ type: 'sendLedColor', args: [r, g, b] });
        await __sleep(10);
      },
    };

    const lidarStore = {
      getDistance: (angle: number) => {
        return _distances[angle % 360] || 0;
      },
      isObstacle: (startAngle: number, endAngle: number, threshold: number) => {
        const s = Math.min(startAngle, endAngle);
        const e = Math.max(startAngle, endAngle);
        for (let i = s; i <= e; i++) {
          const d = _distances[i % 360];
          if (d > 0 && d < threshold) return true;
        }
        return false;
      },
    };

    const __checkAbort = () => {
      if (_aborted) throw new Error('AbortExecution');
    };

    const __highlightBlock = async (id: string) => {
      self.postMessage({ type: 'highlightBlock', id });
      await __sleep(10); // Brief yield to allow UI to react
    };

    const __sleep = (ms: number) => {
      return new Promise<void>((resolve) => {
        if (_aborted) return resolve();
        let elapsed = 0;
        const interval = setInterval(() => {
          elapsed += 50;
          if (_aborted || elapsed >= ms) {
            clearInterval(interval);
            resolve();
          }
        }, 50);
      });
    };

    try {
      const AsyncFunction = async function () {}.constructor as any;
      const execute = new AsyncFunction(
        'serialBridge',
        'lidarStore',
        '__checkAbort',
        '__sleep',
        '__highlightBlock',
        code,
      );
      await execute(serialBridge, lidarStore, __checkAbort, __sleep, __highlightBlock);
      self.postMessage({ type: 'finished' });
    } catch (err: any) {
      if (err?.message === 'AbortExecution') {
        self.postMessage({ type: 'stopped' });
      } else {
        self.postMessage({ type: 'error', error: err?.message });
      }
    }
  }
};
