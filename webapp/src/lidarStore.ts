export class LidarStore {
    private distances: number[] = new Array(360).fill(0);

    update(points: { angle: number, distance: number }[]) {
        for (const pt of points) {
            this.distances[pt.angle % 360] = pt.distance;
        }
    }

    getDistance(angle: number): number {
        return this.distances[Math.floor(angle) % 360];
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
