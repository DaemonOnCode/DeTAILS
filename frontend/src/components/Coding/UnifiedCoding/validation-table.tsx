import { ChangeEvent, FC, useMemo, useState } from 'react';
import { IQECResponse, IQECTResponse, IQECTTyResponse } from '../../../types/Coding/shared';

interface ValidationTableProps {
    codeResponses: IQECResponse[] | IQECTResponse[] | IQECTTyResponse[];
    dispatchCodeResponses: any;
    onViewTranscript: (postId: string | null) => void;
    review: boolean;
    showThemes?: boolean;
    onReRunCoding: () => void;
    onUpdateResponses: (updatedResponses: any[]) => void;
    conflictingResponses?: IQECResponse[];
    currentPostId?: string | null;
    showCoderType?: boolean;
}

function groupByPostId<T extends { postId: string }>(items: T[]): Record<string, T[]> {
    const grouped: Record<string, T[]> = {};
    for (const item of items) {
        if (!grouped[item.postId]) {
            grouped[item.postId] = [];
        }
        grouped[item.postId].push(item);
    }
    return grouped;
}

const ValidationTable: FC<ValidationTableProps> = ({
    codeResponses,
    dispatchCodeResponses,
    onViewTranscript,
    review,
    showThemes,
    onReRunCoding,
    onUpdateResponses,
    conflictingResponses = [],
    currentPostId,
    showCoderType = true
}) => {
    console.log('ValidationTable codeResponses:', codeResponses);

    const [editIndex, setEditIndex] = useState<string | null>(null);
    const [editableRow, setEditableRow] = useState<any>(null);

    const postIdCount = (codeResponses as any).reduce(
        (acc: Record<string, number>, item: any) => {
            acc[item.postId] = (acc[item.postId] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    const renderedPostIds = new Set<string>();

    const handleMark = (index: string, isMarked?: boolean) => {
        const updatedResponses = [...codeResponses];
        const response = updatedResponses.find((r) => r.id === index);
        if (response) {
            response.isMarked = isMarked;
        }
        onUpdateResponses(updatedResponses);
    };

    const handleCommentChange = (index: string, event: ChangeEvent<HTMLTextAreaElement>) => {
        const updatedResponses = [...codeResponses];
        const response = updatedResponses.find((r) => r.id === index);
        if (response) {
            response.comment = event.target.value;
        }
        onUpdateResponses(updatedResponses);
    };

    const handleEditRow = (index: string) => {
        setEditIndex(index);
        const response = codeResponses.find((r) => r.id === index);
        if (response) {
            setEditableRow({ ...response });
        }
    };

    const handleSaveEdit = () => {
        if (editIndex === null) return;
        const updatedResponses = [...codeResponses];
        const responseIndex = updatedResponses.findIndex((r) => r.id === editIndex);
        if (responseIndex === -1) return;
        updatedResponses[responseIndex] = editableRow;
        onUpdateResponses(updatedResponses);
        setEditIndex(null);
    };

    const handleCancelEdit = () => {
        setEditIndex(null);
    };

    const handleInputChange = (field: string, value: string) => {
        setEditableRow({ ...editableRow, [field]: value });
    };

    const handleToggleAllSelectOrReject = (isSelect: boolean) => {
        const allAlreadySetTo = codeResponses.every((r) => r.isMarked === isSelect);
        const finalDecision = allAlreadySetTo ? undefined : isSelect;

        if (finalDecision === undefined) {
            dispatchCodeResponses({ type: 'SET_ALL_UNMARKED' });
        } else {
            dispatchCodeResponses({
                type: finalDecision ? 'SET_ALL_CORRECT' : 'SET_ALL_INCORRECT'
            });
        }
    };

    const groupedByPostId = useMemo(() => groupByPostId(codeResponses), [codeResponses]);
    const allPostIds = Object.keys(groupedByPostId);

    let totalColumns = 3;

    if (showThemes && codeResponses.some((row) => 'theme' in row)) {
        totalColumns += 1;
    }

    if (showCoderType && codeResponses.some((row) => 'type' in row)) {
        totalColumns += 1;
    }

    if (!review) {
        totalColumns += 2;
    }

    if (conflictingResponses.length > 0) {
        totalColumns += 1;
    }

    const isEmpty = codeResponses.length === 0;

    if (isEmpty) {
        return (
            <div className="text-center py-6">
                <p className="text-gray-600">No responses are available right now.</p>
                <p className="text-gray-600">
                    You can{' '}
                    <button
                        onClick={() => onViewTranscript(currentPostId ?? null)}
                        className="text-blue-500 underline">
                        {currentPostId ? 'visit this transcript' : 'visit a transcript'}
                    </button>{' '}
                    to add codes, or wait for the LLM to generate responses.
                </p>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
                <table className="w-full border-collapse relative">
                    <thead className="sticky top-0 z-30 bg-gray-100">
                        <tr>
                            <th className="p-2 bg-gray-100 border border-gray-300 outline outline-1 outline-gray-300">
                                Code
                            </th>
                            <th className="p-2 bg-gray-100 border border-gray-300 outline outline-1 outline-gray-300">
                                Quote
                            </th>
                            <th className="p-2 bg-gray-100 border border-gray-300 outline outline-1 outline-gray-300">
                                Explanation
                            </th>

                            {showThemes && codeResponses.some((r) => 'theme' in r) && (
                                <th className="p-2 bg-gray-100 border border-gray-300 outline outline-1 outline-gray-300">
                                    Theme
                                </th>
                            )}

                            {showCoderType && codeResponses.some((r) => 'type' in r) && (
                                <th className="p-2 bg-gray-100 border border-gray-300 outline outline-1 outline-gray-300">
                                    Type
                                </th>
                            )}

                            {!review && (
                                <>
                                    <th className="p-2 bg-gray-100 border border-gray-300 outline outline-1 outline-gray-300">
                                        Actions
                                        <div className="mt-2 flex justify-center gap-x-2">
                                            <button
                                                className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 text-sm"
                                                onClick={() => handleToggleAllSelectOrReject(true)}>
                                                ✓
                                            </button>
                                            <button
                                                className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-sm"
                                                onClick={() =>
                                                    handleToggleAllSelectOrReject(false)
                                                }>
                                                ✕
                                            </button>
                                        </div>
                                    </th>
                                    <th className="p-2">Comments</th>
                                </>
                            )}

                            {conflictingResponses.length > 0 && (
                                <th className="p-2 bg-gray-100 border border-gray-300 outline outline-1 outline-gray-300">
                                    Conflicts
                                </th>
                            )}
                        </tr>
                    </thead>

                    {allPostIds.map((pid) => {
                        const rowItems = groupedByPostId[pid];
                        return (
                            <tbody key={pid}>
                                <tr
                                    className={`sticky ${review ? 'top-[38px]' : 'top-[76px]'} border-b-2 border-gray-300  bg-gray-50 z-20`}>
                                    <td
                                        colSpan={totalColumns}
                                        className="p-2 font-semibold bg-gray-50 border border-gray-300 outline outline-1 outline-gray-300">
                                        <button
                                            onClick={() => onViewTranscript(pid)}
                                            className="text-blue-500 underline">
                                            Post ID: {pid}
                                        </button>
                                    </td>
                                </tr>

                                {rowItems.map((row) => (
                                    <tr
                                        key={row.id}
                                        className={`transition-all duration-200 ${!review ? 'hover:bg-blue-200 cursor-pencil' : 'hover:bg-gray-100'} ${editIndex === row.id ? 'bg-yellow-100' : ''}`}
                                        onClick={() => !review && onViewTranscript(row.postId)}>
                                        <td className="border border-gray-300 p-2">
                                            {editIndex === row.id ? (
                                                <input
                                                    type="text"
                                                    value={editableRow.code}
                                                    onChange={(e) =>
                                                        handleInputChange('code', e.target.value)
                                                    }
                                                    className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                                                />
                                            ) : (
                                                <span
                                                    className={
                                                        row.isMarked === false
                                                            ? ' line-through decoration-red-500'
                                                            : ''
                                                    }>
                                                    {row.code}
                                                </span>
                                            )}
                                        </td>

                                        <td className="border border-gray-300 p-2 max-w-64">
                                            {editIndex === row.id ? (
                                                <input
                                                    type="text"
                                                    value={editableRow.quote}
                                                    onChange={(e) =>
                                                        handleInputChange('quote', e.target.value)
                                                    }
                                                    className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                                                />
                                            ) : (
                                                <span
                                                    className={
                                                        row.isMarked === false
                                                            ? ' line-through decoration-red-500'
                                                            : ''
                                                    }>
                                                    {row.quote}
                                                </span>
                                            )}
                                        </td>

                                        <td className="border border-gray-300 p-2 max-w-64">
                                            {editIndex === row.id ? (
                                                <input
                                                    type="text"
                                                    value={editableRow.explanation}
                                                    onChange={(e) =>
                                                        handleInputChange(
                                                            'explanation',
                                                            e.target.value
                                                        )
                                                    }
                                                    className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                                                />
                                            ) : (
                                                <span
                                                    className={
                                                        row.isMarked === false
                                                            ? ' line-through decoration-red-500'
                                                            : ''
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
                                                        onChange={(e) =>
                                                            handleInputChange(
                                                                'theme',
                                                                e.target.value
                                                            )
                                                        }
                                                        className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                                                    />
                                                ) : row.theme ? (
                                                    <>{row.theme}</>
                                                ) : (
                                                    <span className="text-gray-400 italic">
                                                        No theme
                                                    </span>
                                                )}
                                            </td>
                                        )}

                                        {showCoderType && 'type' in row && (
                                            <td className="border border-gray-300 p-2">
                                                {editIndex === row.id ? (
                                                    <input
                                                        type="text"
                                                        value={editableRow.type || ''}
                                                        onChange={(e) =>
                                                            handleInputChange(
                                                                'type',
                                                                e.target.value
                                                            )
                                                        }
                                                        className="border border-gray-400 p-1 w-full rounded outline-none focus:ring-2 ring-blue-400"
                                                    />
                                                ) : row.type ? (
                                                    <>{row.type}</>
                                                ) : (
                                                    <span className="text-gray-400 italic">
                                                        No type
                                                    </span>
                                                )}
                                            </td>
                                        )}

                                        {!review && (
                                            <>
                                                <td className="border border-gray-300 p-2">
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
                                                                    onClick={() =>
                                                                        handleMark(
                                                                            row.id,
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
                                                                            : 'bg-gray-300 text-gray-600'
                                                                    }`}
                                                                    onClick={() =>
                                                                        handleMark(
                                                                            row.id,
                                                                            row.isMarked !== false
                                                                                ? false
                                                                                : undefined
                                                                        )
                                                                    }>
                                                                    ✕
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="border border-gray-300 p-2">
                                                    {row.isMarked === false && (
                                                        <textarea
                                                            className="w-full p-2 border border-gray-400 rounded-md"
                                                            placeholder="Enter reason for rejection..."
                                                            value={row.comment || ''}
                                                            onChange={(event) =>
                                                                handleCommentChange(row.id, event)
                                                            }
                                                        />
                                                    )}
                                                </td>
                                            </>
                                        )}

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
                                ))}
                            </tbody>
                        );
                    })}
                </table>
            </div>
        </div>
    );
};

export default ValidationTable;
