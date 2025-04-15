import { useEffect, useRef, useState } from 'react';

interface UseTxtImageResult {
    imgSrc: string | null;
    error: Error | null;
}

const useTxtImage = (txtUrl: string, scale: number = 1): UseTxtImageResult => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));

    useEffect(() => {
        const loadTxt = async () => {
            try {
                const response = await fetch(`file://${txtUrl}`);
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }
                const text = await response.text();

                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                if (!context) {
                    throw new Error('Could not get canvas context');
                }

                const width = 600 * scale;
                const height = 800 * scale;
                canvas.width = width;
                canvas.height = height;

                context.fillStyle = '#fff';
                context.fillRect(0, 0, width, height);

                context.fillStyle = '#000';
                context.font = `${16 * scale}px Arial`;
                const lineHeight = 20 * scale;

                const lines = text.split('\n').slice(0, 60);
                let y = 20 * scale;
                for (const line of lines) {
                    context.fillText(line, 10 * scale, y);
                    y += lineHeight;
                    if (y > height - lineHeight) break;
                }

                const dataUrl = canvas.toDataURL();
                setImgSrc(dataUrl);
            } catch (err: any) {
                console.error('Error loading TXT file:', err);
                setError(err);
            }
        };

        if (txtUrl) {
            loadTxt();
        }
    }, [txtUrl, scale]);

    return { imgSrc, error };
};

export default useTxtImage;
