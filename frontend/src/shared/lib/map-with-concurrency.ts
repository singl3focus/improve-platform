interface MapWithConcurrencyOptions {
  concurrency?: number;
  signal?: AbortSignal;
}

function toConcurrency(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error("Operation aborted.");
  }
}

export async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  mapper: (item: TInput, index: number) => Promise<TOutput>,
  options: MapWithConcurrencyOptions = {}
): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length);
  const concurrency = Math.min(items.length || 1, toConcurrency(options.concurrency));
  let nextIndex = 0;

  async function worker() {
    while (true) {
      throwIfAborted(options.signal);
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}
