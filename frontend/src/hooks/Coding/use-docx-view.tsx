import { useEffect, useState } from 'react';
import mammoth from 'mammoth';
import html2canvas from 'html2canvas';

interface UseDocxImageResult {
    imgSrc: string | null;
    error: Error | null;
}

const useDocxImage = (docxUrl: string, scale: number = 1): UseDocxImageResult => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const loadDocx = async () => {
            try {
                const response = await fetch(`file://${docxUrl}`);
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();

                const result = await mammoth.convertToHtml({ arrayBuffer });
                let htmlString = result.value;

                const pageBreakRegex =
                    /<p[^>]*style="[^"]*page-break-before:\s*always[^"]*"[^>]*><\/p>/i;
                if (pageBreakRegex.test(htmlString)) {
                    htmlString = htmlString.split(pageBreakRegex)[0];
                }

                const container = document.createElement('div');
                container.style.width = `${600 * scale}px`;
                container.style.height = `${800 * scale}px`;
                container.style.overflow = 'hidden';
                container.style.background = '#fff';
                container.innerHTML = htmlString;

                document.body.appendChild(container);

                const canvas = await html2canvas(container, { scale });
                const dataUrl = canvas.toDataURL();
                setImgSrc(dataUrl);

                document.body.removeChild(container);
            } catch (err: any) {
                console.error('Error loading DOCX file:', err);
                setError(err);
            }
        };

        if (docxUrl) {
            loadDocx();
        }
    }, [docxUrl, scale]);

    return { imgSrc, error };
};

export default useDocxImage;
