import { ChangeEvent, FC } from 'react';

interface CardProps {
    title: string;
    description: string;
    buttonText?: string;
    buttonColor?: string;
    onButtonClick?: () => void;
    inputType?: string;
    inputAccept?: string;
    onInputChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

const Card: FC<CardProps> = ({
    title,
    description,
    buttonText,
    buttonColor,
    onButtonClick,
    inputType,
    inputAccept,
    onInputChange
}) => {
    return (
        <div className="bg-gray-100 p-6 rounded-lg shadow-md border border-gray-300 text-center space-y-4 w-96 h-full max-h-44 lg:max-h-52">
            <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>
            <p className="text-gray-600">{description}</p>
            {buttonText && onButtonClick && (
                <button
                    aria-label={buttonText}
                    className={`px-6 py-2 text-white font-bold rounded-md transition ${buttonColor}`}
                    onClick={onButtonClick}>
                    {buttonText}
                </button>
            )}
            {inputType === 'file' && onInputChange && (
                <div className="flex justify-center items-center">
                    <input
                        type="file"
                        accept={inputAccept}
                        className="file-input w-full max-w-xs border border-gray-300 rounded-md px-4 py-2 cursor-pointer"
                        aria-label="Upload File"
                        onChange={onInputChange}
                    />
                </div>
            )}
        </div>
    );
};

export default Card;
