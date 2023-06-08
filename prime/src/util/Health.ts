export const HEALTH_LOW_COLOR = 'rgba(235, 87, 87, 1)';
export const HEALTH_MEDIUM_COLOR = 'rgba(242, 201, 76, 1)';
export const HEALTH_HIGH_COLOR = 'rgba(0, 193, 67, 1)';
export const HEALTH_LOW_THRESHOLD = 1.05;
export const HEALTH_MEDIUM_THRESHOLD = 1.4;

export function getHealthColor(health: number): string {
  if (health < HEALTH_LOW_THRESHOLD) {
    return HEALTH_LOW_COLOR;
  } else if (health < HEALTH_MEDIUM_THRESHOLD) {
    return HEALTH_MEDIUM_COLOR;
  } else {
    return HEALTH_HIGH_COLOR;
  }
}
