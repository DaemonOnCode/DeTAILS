import { useEffect, useRef, useState } from 'react';

const TxtFirstPageImage = ({ txtUrl = '', scale = 1.5 }) => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const loadTxt = async () => {
            try {
                const response = await fetch(`file://${txtUrl}`);
                const text = await response.text();

                const canvas = canvasRef.current;
                if (!canvas) return;
                const context = canvas.getContext('2d');
                if (!context) return;

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
                for (let line of lines) {
                    context.fillText(line, 10 * scale, y);
                    y += lineHeight;
                    if (y > height - lineHeight) break;
                }

                const dataUrl = canvas.toDataURL();
                setImgSrc(dataUrl);
            } catch (error) {
                console.error('Error loading TXT file:', error);
            }
        };

        loadTxt();
    }, [txtUrl, scale]);

    return (
        <div className="flex justify-center items-center bg-gray-100">
            <div className="bg-white p-2 pb-0">
                {imgSrc ? (
                    <img src={imgSrc} alt="TXT First Page Preview" className="max-w-full" />
                ) : (
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                )}
            </div>
        </div>
    );
};

export default TxtFirstPageImage;
