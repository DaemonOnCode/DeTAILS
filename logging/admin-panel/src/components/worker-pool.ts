export interface TaskOptions {
  responseType: string;
  errorType?: string;
  transferable?: Transferable[];
}

export type Message = { type: string; id?: number; [key: string]: any };

export default class WorkerPool {
  private workers: Worker[];
  private available: number[];
  private queue: Array<() => void> = [];
  private nextMsgId = 1;

  constructor(workerScriptUrl: string, poolSize: number) {
    this.workers = Array.from(
      { length: poolSize },
      () => new Worker(workerScriptUrl, { type: "module" })
    );
    this.workers.forEach((worker, _) => {
      worker.addEventListener("error", (e) => {
        console.error("[worker]", workerScriptUrl, "error:", e);
      });
      worker.addEventListener("messageerror", (e) => {
        console.error("[worker] message error:", e);
      });
    });
    this.available = this.workers.map((_, i) => i);
  }

  async broadcastInit(
    baseMessage: Omit<Message, "id">,
    options: TaskOptions
  ): Promise<void> {
    const { responseType, errorType = "error" } = options;

    await Promise.all(
      this.workers.map((worker) => {
        const msgId = this.nextMsgId++;
        return new Promise<void>((resolve, reject) => {
          function listener(event: MessageEvent) {
            const { type, id, data } = event.data;
            if (id !== msgId) return;
            worker.removeEventListener("message", listener);
            if (type === responseType) resolve();
            else if (type === errorType) reject(new Error(data));
          }
          worker.addEventListener("message", listener);

          const message = { ...baseMessage, id: msgId };
          worker.postMessage(message);
        });
      })
    );
  }

  runTask<T>(
    baseMessage: Omit<Message, "id">,
    options: TaskOptions
  ): Promise<T> {
    const { responseType, errorType = "error", transferable } = options;
    const msgId = this.nextMsgId++;

    return new Promise<T>((resolve, reject) => {
      const tryRun = () => {
        if (this.available.length > 0) {
          const idx = this.available.shift()!;
          const worker = this.workers[idx];

          const listener = (event: MessageEvent) => {
            const { type, id, data } = event.data as Message;
            if (id !== msgId) return;
            worker.removeEventListener("message", listener);
            this.available.push(idx);
            if (this.queue.length) this.queue.shift()!();
            if (type === responseType) resolve(data);
            else if (type === errorType) reject(new Error(data));
          };

          worker.addEventListener("message", listener);

          worker.postMessage({ ...baseMessage, id: msgId }, transferable ?? []);
        } else {
          this.queue.push(tryRun);
        }
      };
      tryRun();
    });
  }

  terminate() {
    this.workers.forEach((w) => w.terminate());
  }
}
