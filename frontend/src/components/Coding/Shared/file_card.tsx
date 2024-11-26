import { FileCardProps } from '../../../types/Coding/props';

const FileCard = ({ filePath, fileName, onRemove }: FileCardProps) => {
    return (
        <div className="relative flex items-center justify-center h-32 w-32 border rounded shadow-lg bg-white p-4">
            <button
                onClick={() => onRemove(filePath)}
                className="absolute top-2 right-2 text-red-500 font-bold">
                &times;
            </button>
            <p className="text-center text-gray-800 font-semibold text-sm truncate w-full">
                {fileName}
            </p>
        </div>
    );
};

export default FileCard;
