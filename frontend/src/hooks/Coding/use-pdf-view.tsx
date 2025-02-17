import { useEffect, useState } from 'react';
import { GlobalWorkerOptions, getDocument, version } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;

interface UsePdfImageResult {
    imgSrc: string | null;
    error: Error | null;
}

const usePdfImage = (pdfUrl: string, scale: number = 1): UsePdfImageResult => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const loadPdf = async () => {
            try {
                const loadingTask = getDocument(`file://${pdfUrl}`);
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);

                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!context) {
                    throw new Error('Could not get canvas context');
                }

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const renderContext = { canvasContext: context, viewport };
                const renderTask = page.render(renderContext);
                await renderTask.promise;

                const dataUrl = canvas.toDataURL();
                setImgSrc(dataUrl);
            } catch (err: any) {
                console.error('Error rendering PDF page:', err);
                setError(err);
            }
        };

        if (pdfUrl) {
            loadPdf();
        }
    }, [pdfUrl, scale]);

    return { imgSrc, error };
};

export default usePdfImage;
