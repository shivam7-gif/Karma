export class LockManager {
  private locks: Map<string, Promise<void>> = new Map();

  async acquire(key: string, timeoutMs = 30000): Promise<() => void> {
    while (this.locks.has(key)) {
      const current = this.locks.get(key)!;
      try {
        await Promise.race([
          current,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timed out waiting for lock on resource: ${key}`)), timeoutMs)
          ),
        ]);
      } catch (err) {
        // If timed out, propagate error
        throw err;
      }
    }

    let releaseResolve!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseResolve = resolve;
    });

    this.locks.set(key, lockPromise);

    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.locks.delete(key);
        releaseResolve();
      }
    };
  }

  async withLock<T>(key: string, fn: () => Promise<T>, timeoutMs = 30000): Promise<T> {
    const release = await this.acquire(key, timeoutMs);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  isLocked(key: string): boolean {
    return this.locks.has(key);
  }
}

export const lockManager = new LockManager();
