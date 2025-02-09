import { ChangeEvent, FC, useState } from 'react';
import { IQECResponse, IQECTResponse, IQECTTyResponse } from '../../../types/Coding/shared';

interface ValidationTableProps {
    codeResponses: IQECResponse[] | IQECTResponse[] | IQECTTyResponse[];
    onViewTranscript: (postId: string | null) => void;
    review: boolean;
    showThemes?: boolean;
    onReRunCoding: () => void;
    onUpdateResponses: (updatedResponses: any[]) => void;
    conflictingResponses?: IQECResponse[];
}

const ValidationTable: FC<ValidationTableProps> = ({
    codeResponses,
    onViewTranscript,
    review,
    showThemes,
    onReRunCoding,
    onUpdateResponses,
    conflictingResponses = []
}) => {
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [editableRow, setEditableRow] = useState<any>(null);

    // 1. Count how many times each postId appears
    const postIdCount = (codeResponses as any).reduce(
        (acc: Record<string, number>, item: any) => {
            acc[item.postId] = (acc[item.postId] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    // Track which postIds have already rendered their Post ID cell
    const renderedPostIds = new Set<string>();

    // Marking responses
    const handleMark = (index: number, isMarked?: boolean) => {
        const updatedResponses = [...codeResponses];
        updatedResponses[index].isMarked = isMarked;
        onUpdateResponses(updatedResponses);
    };

    // Comments
    const handleCommentChange = (index: number, event: ChangeEvent<HTMLTextAreaElement>) => {
        const updatedResponses = [...codeResponses];
        updatedResponses[index].comment = event.target.value;
        onUpdateResponses(updatedResponses);
    };

    // Edit handling
    const handleEditRow = (index: number) => {
        setEditIndex(index);
        setEditableRow({ ...codeResponses[index] });
    };

    const handleSaveEdit = () => {
        if (editIndex === null) return;
        const updatedResponses = [...codeResponses];
        updatedResponses[editIndex] = editableRow;
        onUpdateResponses(updatedResponses);
        setEditIndex(null);
    };

    const handleCancelEdit = () => {
        setEditIndex(null);
    };

    const handleInputChange = (field: string, value: string) => {
        setEditableRow({ ...editableRow, [field]: value });
    };

    const isEmpty = codeResponses.length === 0;

    return (
        <div className="p-6 overflow-auto">
            {/* If there are no responses, show a user-friendly message */}
            {isEmpty ? (
                <div className="text-center py-6">
                    <p className="text-gray-600">No responses are available right now.</p>
                    <p className="text-gray-600">
                        You can{' '}
                        <button
                            onClick={() => onViewTranscript(null)}
                            className="text-blue-500 underline">
                            visit a transcript
                        </button>{' '}
                        to add codes, or wait for the LLM to generate responses.
                    </p>
                </div>
            ) : (
                <table className="w-full border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-200">
                            {/* Post ID (merged) */}
                            <th className="border border-gray-300 p-2">Post ID</th>
                            <th className="border border-gray-300 p-2">Code</th>
                            <th className="border border-gray-300 p-2">Quote</th>
                            <th className="border border-gray-300 p-2">Explanation</th>
                            {showThemes && <th className="border border-gray-300 p-2">Theme</th>}
                            {'type' in (codeResponses?.[0] ?? {}) && (
                                <th className="border border-gray-300 p-2">Type</th>
                            )}
                            {!review && (
                                <>
                                    <th className="border border-gray-300 p-2">Actions</th>
                                    <th className="border border-gray-300 p-2">Comments</th>
                                </>
                            )}
                            {conflictingResponses.length > 0 && (
                                <th className="border border-gray-300 p-2">Conflicts</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {codeResponses.map((row, index) => {
                            const isFirstOccurrence = !renderedPostIds.has(row.postId);

                            return (
                                <tr
                                    key={index}
                                    className={`transition-all duration-200 ${
                                        editIndex === index ? 'bg-yellow-100' : ''
                                    }`}>
                                    {/* Post ID cell with rowSpan */}
                                    {isFirstOccurrence && (
                                        <td
                                            className="border border-gray-300 p-2 align-top"
                                            rowSpan={postIdCount[row.postId]}>
                                            <button
                                                className="text-blue-500 underline"
                                                onClick={() => onViewTranscript(row.postId)}>
                                                {row.postId}
                                            </button>
                                        </td>
                                    )}
                                    {/* Mark this postId as rendered */}
                                    {isFirstOccurrence && renderedPostIds.add(row.postId)}

                                    {/* Code */}
                                    <td className="border border-gray-300 p-2">
                                        {editIndex === index ? (
                                            <input
                                                type="text"
                                                value={editableRow.code}
                                                onChange={(e) =>
                                                    handleInputChange('code', e.target.value)
                                                }
                                                className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                                            />
                                        ) : (
                                            row.code
                                        )}
                                    </td>

                                    {/* Quote */}
                                    <td className="border border-gray-300 p-2">
                                        {editIndex === index ? (
                                            <input
                                                type="text"
                                                value={editableRow.quote}
                                                onChange={(e) =>
                                                    handleInputChange('quote', e.target.value)
                                                }
                                                className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                                            />
                                        ) : (
                                            row.quote
                                        )}
                                    </td>

                                    {/* Explanation */}
                                    <td className="border border-gray-300 p-2">
                                        {editIndex === index ? (
                                            <input
                                                type="text"
                                                value={editableRow.explanation}
                                                onChange={(e) =>
                                                    handleInputChange('explanation', e.target.value)
                                                }
                                                className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                                            />
                                        ) : (
                                            row.explanation
                                        )}
                                    </td>

                                    {/* Theme (if showThemes) */}
                                    {showThemes && 'theme' in row && (
                                        <td className="border border-gray-300 p-2">
                                            {editIndex === index ? (
                                                <input
                                                    type="text"
                                                    value={editableRow.theme || ''}
                                                    onChange={(e) =>
                                                        handleInputChange('theme', e.target.value)
                                                    }
                                                    className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                                                />
                                            ) : row.theme ? (
                                                row.theme
                                            ) : (
                                                <span className="text-gray-400 italic">
                                                    No theme assigned
                                                </span>
                                            )}
                                        </td>
                                    )}

                                    {/* Type (if row has a type property) */}
                                    {'type' in row && (
                                        <td className="border border-gray-300 p-2">
                                            {editIndex === index ? (
                                                <input
                                                    type="text"
                                                    value={editableRow.type || ''}
                                                    onChange={(e) =>
                                                        handleInputChange('type', e.target.value)
                                                    }
                                                    className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                                                />
                                            ) : row.type ? (
                                                row.type
                                            ) : (
                                                <span className="text-gray-400 italic">
                                                    No type assigned
                                                </span>
                                            )}
                                        </td>
                                    )}

                                    {/* Actions (if not in review mode) */}
                                    {!review && (
                                        <>
                                            <td className="border border-gray-300 p-2">
                                                <div className="flex justify-center gap-2 h-full text-center">
                                                    {editIndex === index ? (
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
                                                                        : 'bg-gray-300 text-gray-500'
                                                                }`}
                                                                onClick={() =>
                                                                    handleMark(
                                                                        index,
                                                                        row.isMarked !== true
                                                                            ? true
                                                                            : undefined
                                                                    )
                                                                }>
                                                                ✓
                                                            </button>
                                                            <button
                                                                className={`px-3 py-2 rounded-md ${
                                                                    row.isMarked === false
                                                                        ? 'bg-red-500 text-white'
                                                                        : 'bg-gray-300 text-gray-500'
                                                                }`}
                                                                onClick={() =>
                                                                    handleMark(
                                                                        index,
                                                                        row.isMarked !== false
                                                                            ? false
                                                                            : undefined
                                                                    )
                                                                }>
                                                                ✕
                                                            </button>
                                                            <button
                                                                className="px-3 py-2 bg-yellow-500 text-white rounded-md"
                                                                onClick={() => handleEditRow(index)}
                                                                title="Click to edit">
                                                                ✏️
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Comments */}
                                            <td className="border border-gray-300 p-2">
                                                {row.isMarked === false && (
                                                    <textarea
                                                        className="w-full p-2 border border-gray-400 rounded-md"
                                                        placeholder="Enter reason for rejection..."
                                                        value={row.comment || ''}
                                                        onChange={(event) =>
                                                            handleCommentChange(index, event)
                                                        }
                                                    />
                                                )}
                                            </td>
                                        </>
                                    )}

                                    {/* Conflicts */}
                                    {conflictingResponses.length > 0 && (
                                        <td className="border border-gray-300 p-2">
                                            {conflictingResponses
                                                .filter(
                                                    (conflict) =>
                                                        conflict.code === row.code &&
                                                        conflict.quote === row.quote
                                                )
                                                .map((conflict, i) => (
                                                    <div key={i}>
                                                        <button
                                                            className="text-red-500 underline"
                                                            onClick={() =>
                                                                onViewTranscript(row.postId)
                                                            }>
                                                            Go to Conflict
                                                        </button>
                                                    </div>
                                                ))}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default ValidationTable;
