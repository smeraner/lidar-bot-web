import { describe, it, expect, beforeEach } from 'vitest';
import { LidarStore } from './lidarStore';

describe('LidarStore', () => {
  let store: LidarStore;

  beforeEach(() => {
    store = new LidarStore();
  });

  it('should initialize with 360 zeros', () => {
    const distances = store.getAllDistances();
    expect(distances.length).toBe(360);
    expect(distances.every((d) => d === 0)).toBe(true);
  });

  it('should update and retrieve distances correctly', () => {
    store.update([
      { angle: 90, distance: 100 },
      { angle: 180, distance: 200 },
    ]);
    expect(store.getDistance(90)).toBe(100);
    expect(store.getDistance(180)).toBe(200);
    expect(store.getDistance(0)).toBe(0);
  });

  it('should handle angles greater than 360', () => {
    store.update([{ angle: 450, distance: 50 }]); // 450 % 360 = 90
    expect(store.getDistance(90)).toBe(50);
  });

  it('should detect obstacles within threshold', () => {
    store.update([{ angle: 10, distance: 150 }]);

    // Should detect because 150 < 200
    expect(store.isObstacle(0, 20, 200)).toBe(true);

    // Should not detect because 150 is not < 100
    expect(store.isObstacle(0, 20, 100)).toBe(false);

    // Should not detect because angle 30 is not in range 0-20
    store.update([{ angle: 30, distance: 50 }]);
    expect(store.isObstacle(0, 20, 200)).toBe(true); // Still true because of angle 10
  });
});
