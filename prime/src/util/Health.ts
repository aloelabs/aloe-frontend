export function getHealthColor(health: number): string {
  if (health <= 1.1) {
    return '#EB5757';
  } else if (health <= 1.25) {
    return '#F2C94C';
  } else {
    return '#00C143';
  }
}
