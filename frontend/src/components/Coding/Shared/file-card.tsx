import useDocxImage from '../../../hooks/Coding/use-docx-view';
import usePdfImage from '../../../hooks/Coding/use-pdf-view';
import useTxtImage from '../../../hooks/Coding/use-txt-view';
import { FileCardProps } from '../../../types/Coding/props';
import { FaFilePdf } from 'react-icons/fa';
import { SiGoogledocs } from 'react-icons/si';
import TxtFileIcon from '../../Shared/Icons/txt-file';

import { ImCross } from 'react-icons/im';

const FileCard = ({ filePath, fileName, onRemove }: FileCardProps) => {
    // Call all hooks unconditionally by passing an empty string when not applicable.
    const pdfResult = usePdfImage(fileName.endsWith('.pdf') ? filePath : '');
    const docxResult = useDocxImage(fileName.endsWith('.docx') ? filePath : '');
    const txtResult = useTxtImage(fileName.endsWith('.txt') ? filePath : '');

    const Icon = () => {
        const splits = fileName.toLowerCase().split('.');
        console.log(splits, 'splits');
        switch (splits[splits.length - 1]) {
            case 'pdf':
                return <FaFilePdf className="h-4 min-w-4 w-4 fill-[#F71D13]" />;
            case 'docx':
                return <SiGoogledocs className="h-4 min-w-4 w-4 fill-[#4285F4]" />;
            case 'txt':
                return <TxtFileIcon className="h-4 min-w-4 w-4" />;
            default:
                return <></>;
        }
    };

    // Use the result from the hook that applies (only one should have a non-null imgSrc)
    const imgSrc = pdfResult.imgSrc || docxResult.imgSrc || txtResult.imgSrc;
    const error = pdfResult.error || docxResult.error || txtResult.error;

    return (
        <div className="relative flex items-center justify-center h-48 w-36 border rounded shadow-lg bg-white">
            <div className="absolute -top-2 -right-2 text-red-500 bg-white rounded-full font-bold border h-6 w-6 flex justify-center items-center">
                <button onClick={() => onRemove(filePath)} className="">
                    <ImCross className="h-3 w-3" />
                </button>
            </div>
            {imgSrc ? (
                <img src={imgSrc} alt="File Preview" className="max-w-full p-2 pb-0" />
            ) : error ? (
                <div>Error in loading...</div>
            ) : (
                <div>Loading...</div>
            )}
            <div className="absolute bottom-0 left-0 h-1/2 bg-gradient-to-t from-gray-100 via-[rgba(243,244,246,0.8)] to-transparent truncate text-ellipsis w-full flex justify-start items-end p-2 gap-1 text-xs">
                <Icon />
                <span className="min-w-0 truncate">{fileName}</span>
            </div>
        </div>
    );
};

export default FileCard;
