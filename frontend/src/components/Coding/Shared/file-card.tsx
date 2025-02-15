import { FileCardProps } from '../../../types/Coding/props';
import PdfFirstPageImage from '../../Shared/pdf-viewer';

const FileCard = ({ filePath, fileName, onRemove }: FileCardProps) => {
    const fileRenderer = (fileName: string) => {
        if (fileName.endsWith('.pdf')) {
            return <PdfFirstPageImage pdfUrl={filePath} />;
        }

        return (
            <p className="text-center text-gray-800 font-semibold text-sm truncate w-full">
                {fileName}
            </p>
        );
    };

    return (
        <div className="relative flex items-center justify-center h-32 w-32 border rounded shadow-lg bg-white p-4 overflow-clip">
            <button
                onClick={() => onRemove(filePath)}
                className="absolute top-2 right-2 text-red-500 font-bold">
                &times;
            </button>
            {fileRenderer(fileName)}
        </div>
    );
};

export default FileCard;
