import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';

interface UseDocxImageResult {
    imgSrc: string | null;
    error: Error | null;
}

class Semaphore {
    private q: Array<() => void> = [];
    private n: number;
    constructor(max = 5) {
        this.n = max;
    }
    async acquire() {
        if (this.n > 0) {
            this.n--;
            return;
        }
        await new Promise<void>((res) => this.q.push(res));
    }
    release() {
        const next = this.q.shift();
        if (next) next();
        else this.n++;
    }
}
const renderGate = new Semaphore(5);

declare global {
    interface Window {
        __DOCX_WORKER__?: Worker;
    }
}

const useDocxImage = (docxUrl: string, scale: number = 1): UseDocxImageResult => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const lastBlobUrlRef = useRef<string | null>(null);

    const getDocxWorker = (): Worker => {
        if (typeof window === 'undefined') {
            throw new Error('Workers are not available during SSR');
        }
        if (!window.__DOCX_WORKER__) {
            const base = (typeof process !== 'undefined' && (process as any).env?.PUBLIC_URL) || '';
            const workerUrl = (base ? base.replace(/\/$/, '') : '') + '/workers/docx.worker.js';
            window.__DOCX_WORKER__ = new Worker(workerUrl, { type: 'module' });
        }
        return window.__DOCX_WORKER__;
    };

    useEffect(() => {
        if (!docxUrl) return;

        let cancelled = false;
        setImgSrc(null);
        setError(null);

        const controller = new AbortController();

        (async () => {
            await renderGate.acquire();
            try {
                const res = await fetch(`file://${docxUrl}`, { signal: controller.signal });
                if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
                const arrayBuffer = await res.arrayBuffer();
                if (cancelled) return;

                const worker = getDocxWorker();
                const htmlString: string = await new Promise((resolve, reject) => {
                    const onMessage = (e: MessageEvent<{ html?: string; error?: string }>) => {
                        worker.removeEventListener('message', onMessage);
                        worker.removeEventListener('error', onError);
                        if (e.data?.error) reject(new Error(e.data.error));
                        else resolve(e.data?.html ?? '');
                    };
                    const onError = (e: ErrorEvent) => {
                        worker.removeEventListener('message', onMessage);
                        worker.removeEventListener('error', onError);
                        reject(e.error || new Error(e.message));
                    };
                    worker.addEventListener('message', onMessage);
                    worker.addEventListener('error', onError);
                    worker.postMessage({ arrayBuffer }, [arrayBuffer]);
                });

                if (cancelled) return;

                const container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.left = '-10000px';
                container.style.top = '-10000px';
                container.style.width = `${600 * scale}px`;
                container.style.height = `${800 * scale}px`;
                container.style.overflow = 'hidden';
                container.style.background = '#fff';
                container.innerHTML = htmlString;
                document.body.appendChild(container);

                await new Promise((r) => requestAnimationFrame(() => r(null)));

                const canvas = await html2canvas(container, { scale });
                const blob: Blob = await new Promise((resolve, reject) =>
                    canvas.toBlob((b) =>
                        b ? resolve(b) : reject(new Error('toBlob() returned null'))
                    )
                );

                const blobUrl = URL.createObjectURL(blob);
                document.body.removeChild(container);

                if (!cancelled) {
                    if (lastBlobUrlRef.current) URL.revokeObjectURL(lastBlobUrlRef.current);
                    lastBlobUrlRef.current = blobUrl;
                    setImgSrc(blobUrl);
                }
            } catch (err: any) {
                if (!cancelled) setError(err);
            } finally {
                renderGate.release();
            }
        })();

        return () => {
            cancelled = true;
            controller.abort();
            if (lastBlobUrlRef.current) {
                URL.revokeObjectURL(lastBlobUrlRef.current);
                lastBlobUrlRef.current = null;
            }
        };
    }, [docxUrl, scale]);

    return { imgSrc, error };
};

export default useDocxImage;
