import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument, version } from 'pdfjs-dist';

// Set up PDF.js worker
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;

const PdfFirstPageImage = ({ pdfUrl = '', scale = 1.5 }) => {
    console.log('PdfFirstPageImage rendering...', pdfUrl);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const loadFirstPage = async () => {
            try {
                // Load the PDF document
                const loadingTask = getDocument(`file://${pdfUrl}`);
                const pdf = await loadingTask.promise;
                // Get the first page
                const page = await pdf.getPage(1);

                // Set the viewport with the desired scale
                const viewport = page.getViewport({ scale });
                const canvas = canvasRef.current;
                if (!canvas) return;
                const context = canvas.getContext('2d');

                // Set canvas dimensions to match the PDF page dimensions
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // Render the PDF page into the canvas context
                const renderContext = {
                    canvasContext: context as CanvasRenderingContext2D,
                    viewport: viewport
                };
                const renderTask = page.render(renderContext);
                await renderTask.promise;

                // Convert the canvas content to a data URL (base64 image)
                const dataUrl = canvas.toDataURL();
                setImgSrc(dataUrl);
            } catch (error) {
                console.error('Error rendering PDF page:', error);
            }
        };

        loadFirstPage();
    }, [pdfUrl, scale]);

    return (
        <div className="flex justify-center items-center bg-gray-100">
            <div className="bg-white shadow-lg rounded">
                {imgSrc ? (
                    <img src={imgSrc} alt="PDF First Page Preview" className="max-w-full" />
                ) : (
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                )}
            </div>
        </div>
    );
};

export default PdfFirstPageImage;
