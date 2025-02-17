import { useEffect, useState } from 'react';
import mammoth from 'mammoth';
import html2canvas from 'html2canvas';

const DocxFirstPageImage = ({ docxUrl = '', scale = 1.5 }) => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);

    useEffect(() => {
        const loadDocx = async () => {
            try {
                // Fetch the DOCX file as an ArrayBuffer
                const response = await fetch(`file://${docxUrl}`);
                const arrayBuffer = await response.arrayBuffer();

                // Convert DOCX to HTML using Mammoth.js
                const result = await mammoth.convertToHtml({ arrayBuffer });
                let htmlString = result.value; // Converted HTML

                const pageBreakRegex =
                    /<p[^>]*style="[^"]*page-break-before:\s*always[^"]*"[^>]*><\/p>/i;
                if (pageBreakRegex.test(htmlString)) {
                    htmlString = htmlString.split(pageBreakRegex)[0];
                }

                // Create a temporary container for the HTML content
                const container = document.createElement('div');
                container.style.width = `${600 * scale}px`;
                container.style.height = `${800 * scale}px`;
                container.style.overflow = 'hidden';
                container.style.background = '#fff';
                container.innerHTML = htmlString;

                // Append container to the body so html2canvas can work on it
                document.body.appendChild(container);

                // Capture the container as a canvas image
                const canvas = await html2canvas(container, { scale });
                const dataUrl = canvas.toDataURL();
                setImgSrc(dataUrl);

                document.body.removeChild(container);
            } catch (error) {
                console.error('Error loading DOCX file:', error);
            }
        };

        loadDocx();
    }, [docxUrl, scale]);

    return (
        <div className="flex justify-center items-center bg-gray-100">
            <div className="bg-white p-2 pb-0">
                {imgSrc ? (
                    <img src={imgSrc} alt="DOCX First Page Preview" className="max-w-full" />
                ) : (
                    <div>Loading...</div>
                )}
            </div>
        </div>
    );
};

export default DocxFirstPageImage;
