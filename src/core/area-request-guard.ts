export interface AreaRequestGuard {
  begin(): number;
  isCurrent(token: number): boolean;
}

export function createAreaRequestGuard(): AreaRequestGuard {
  let current = 0;

  return {
    begin() {
      current += 1;
      return current;
    },
    isCurrent(token) {
      return token === current;
    },
  };
}
