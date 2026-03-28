import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SerialBridge } from './serial';

describe('SerialBridge', () => {
  let bridge: SerialBridge;

  beforeEach(() => {
    bridge = new SerialBridge();
    // Mock the global navigator if not present
    if (!global.navigator) {
      (global as any).navigator = {};
    }
  });

  it('should initialize disconnected', () => {
    expect(bridge.isConnected).toBe(false);
    expect(bridge.robotStatus).toBe('disconnected');
  });

  it('should parse lidar data correctly', () => {
    return new Promise<void>((resolve) => {
      bridge.onLidarData((points) => {
        expect(points.length).toBe(2);
        expect(points[0]).toEqual({ angle: 90, distance: 100 });
        expect(points[1]).toEqual({ angle: 180, distance: 200 });
        resolve();
      });

      // We simulate handling an incoming line
      // Since handleIncomingLine is private, we access it via any
      (bridge as any).handleIncomingLine('lidar:90,100,180,200');
    });
  });

  it('should update robot status on status message', () => {
    return new Promise<void>((resolve) => {
      bridge.onRobotStatus((status) => {
        if (status === 'connected') {
          expect(bridge.robotStatus).toBe('connected');
          resolve();
        }
      });
      (bridge as any).handleIncomingLine('status:robot_connected');
    });
  });
});
