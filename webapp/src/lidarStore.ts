export class LidarStore {
  private distances: number[] = new Array(360).fill(0);
  private imu: { pitch: number; roll: number; yaw: number } = { pitch: 0, roll: 0, yaw: 0 };

  update(points: { angle: number; distance: number }[]) {
    for (const pt of points) {
      const idx = Math.round(pt.angle) % 360;
      this.distances[idx] = pt.distance;
    }
  }

  updateImu(pitch: number, roll: number, yaw: number) {
    this.imu = { pitch, roll, yaw };
  }

  getImu() {
    return this.imu;
  }

  getDistance(angle: number): number {
    return this.distances[Math.round(angle) % 360];
  }

  isObstacle(angleStart: number, angleEnd: number, threshold: number): boolean {
    for (let i = angleStart; i <= angleEnd; i++) {
      const d = this.getDistance(i);
      if (d > 0 && d < threshold) return true;
    }
    return false;
  }

  getAllDistances(): number[] {
    return [...this.distances];
  }
}

export const lidarStore = new LidarStore();
