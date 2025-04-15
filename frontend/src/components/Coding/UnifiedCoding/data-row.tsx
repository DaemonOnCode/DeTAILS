import { FC, memo } from 'react';
import { IQECResponse, IQECTResponse, IQECTTyResponse } from '../../../types/Coding/shared';

interface DataRowProps {
    row: IQECResponse | IQECTResponse | IQECTTyResponse;
    editIndex: string | null;
    editableRow: any;
    handleInputChange: (field: string, value: string) => void;
    handleMark: (index: string, isMarked?: boolean) => void;
    handleSaveEdit: () => void;
    handleCancelEdit: () => void;
    review: boolean;
    showThemes?: boolean;
    showCoderType?: boolean;
    onViewTranscript: (postId: string | null) => void;
    conflictingResponses: IQECResponse[];
}

const DataRow: FC<DataRowProps> = memo(
    ({
        row,
        editIndex,
        editableRow,
        handleInputChange,
        handleMark,
        handleSaveEdit,
        handleCancelEdit,
        review,
        showThemes,
        showCoderType,
        onViewTranscript,
        conflictingResponses
    }) => {
        return (
            <tr
                className={`transition-all duration-200 ${
                    !review ? 'hover:bg-blue-200 cursor-pointer' : 'hover:bg-gray-100'
                } ${editIndex === row.id ? 'bg-yellow-100' : ''}`}
                onClick={() => !review && onViewTranscript(row.postId)}>
                <td className="border border-gray-300 p-2 max-w-48">
                    {editIndex === row.id ? (
                        <input
                            type="text"
                            value={editableRow.code}
                            onChange={(e) => handleInputChange('code', e.target.value)}
                            className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                        />
                    ) : (
                        <span
                            className={
                                row.isMarked === false ? 'line-through decoration-red-500' : ''
                            }>
                            {row.code}
                        </span>
                    )}
                </td>

                {'subCode' in row && showCoderType && (
                    <td className="border border-gray-300 p-2">
                        {editIndex === row.id ? (
                            <input
                                type="text"
                                value={editableRow.subCode || ''}
                                onChange={(e) => handleInputChange('subCode', e.target.value)}
                                className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                            />
                        ) : row.subCode ? (
                            <>{row.subCode}</>
                        ) : (
                            <span className="text-gray-400 italic">No Code</span>
                        )}
                    </td>
                )}

                <td className="border border-gray-300 p-2 max-w-64 overflow-wrap">
                    {editIndex === row.id ? (
                        <input
                            type="text"
                            value={editableRow.quote}
                            onChange={(e) => handleInputChange('quote', e.target.value)}
                            className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                        />
                    ) : (
                        <span
                            className={
                                row.isMarked === false ? 'line-through decoration-red-500' : ''
                            }>
                            {row.quote}
                        </span>
                    )}
                </td>

                <td className="border border-gray-300 p-2 max-w-64 overflow-wrap">
                    {editIndex === row.id ? (
                        <input
                            type="text"
                            value={editableRow.explanation}
                            onChange={(e) => handleInputChange('explanation', e.target.value)}
                            className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                        />
                    ) : (
                        <span
                            className={
                                row.isMarked === false ? 'line-through decoration-red-500' : ''
                            }>
                            {row.explanation}
                        </span>
                    )}
                </td>

                {showThemes && 'theme' in row && (
                    <td className="border border-gray-300 p-2">
                        {editIndex === row.id ? (
                            <input
                                type="text"
                                value={editableRow.theme || ''}
                                onChange={(e) => handleInputChange('theme', e.target.value)}
                                className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                            />
                        ) : row.theme ? (
                            row.theme
                        ) : (
                            <span className="text-gray-400 italic">No theme</span>
                        )}
                    </td>
                )}

                {showCoderType && 'type' in row && (
                    <td className="border border-gray-300 p-2">
                        {editIndex === row.id ? (
                            <input
                                type="text"
                                value={editableRow.type || ''}
                                onChange={(e) => handleInputChange('type', e.target.value)}
                                className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                            />
                        ) : row.type ? (
                            row.type
                        ) : (
                            <span className="text-gray-400 italic">No type</span>
                        )}
                    </td>
                )}

                {!review && (
                    <td className="border border-gray-300 p-2 max-w-28">
                        <div className="flex justify-center gap-2 text-center">
                            {editIndex === row.id ? (
                                <>
                                    <button
                                        className="px-3 py-2 bg-green-500 text-white rounded-md"
                                        onClick={handleSaveEdit}>
                                        💾
                                    </button>
                                    <button
                                        className="px-3 py-2 bg-red-500 text-white rounded-md"
                                        onClick={handleCancelEdit}>
                                        ❌
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        className={`px-3 py-2 rounded-md ${
                                            row.isMarked === true
                                                ? 'bg-green-500 text-white'
                                                : 'bg-gray-300 text-gray-600'
                                        }`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleMark(
                                                row.id,
                                                row.isMarked !== true ? true : undefined
                                            );
                                        }}>
                                        ✓
                                    </button>
                                    <button
                                        className={`px-3 py-2 rounded-md ${
                                            row.isMarked === false
                                                ? 'bg-red-500 text-white'
                                                : 'bg-gray-300 text-gray-600'
                                        }`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleMark(
                                                row.id,
                                                row.isMarked !== false ? false : undefined
                                            );
                                        }}>
                                        ✕
                                    </button>
                                </>
                            )}
                        </div>
                    </td>
                )}

                {conflictingResponses.length > 0 && (
                    <td className="border border-gray-300 p-2">
                        {conflictingResponses
                            .filter(
                                (conflict) =>
                                    conflict.code === row.code && conflict.quote === row.quote
                            )
                            .map((conflict, i) => (
                                <div key={i}>
                                    <button
                                        className="text-red-500 underline"
                                        onClick={() => onViewTranscript(row.postId)}>
                                        Go to Conflict
                                    </button>
                                </div>
                            ))}
                    </td>
                )}
            </tr>
        );
    }
);

export default DataRow;
