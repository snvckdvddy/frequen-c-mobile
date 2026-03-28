let pendingWelcomeBoot = false;

export function armWelcomeBoot() {
  pendingWelcomeBoot = true;
}

export function clearWelcomeBoot() {
  pendingWelcomeBoot = false;
}

export function shouldShowWelcomeBoot() {
  return pendingWelcomeBoot;
}
