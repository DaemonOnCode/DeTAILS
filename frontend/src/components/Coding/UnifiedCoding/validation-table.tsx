// src/components/ValidationTable.tsx
import { ChangeEvent, FC, useEffect, useMemo, useState } from 'react';
import { IQECResponse, IQECTResponse, IQECTTyResponse } from '../../../types/Coding/shared';
import useScrollRestoration from '../../../hooks/Shared/use-scroll-restoration';
import { useLocation } from 'react-router-dom';
import ObservableTBody from './observable-table-body';

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
    const location = useLocation();
    const [editIndex, setEditIndex] = useState<string | null>(null);
    const [editableRow, setEditableRow] = useState<any>(null);

    const { scrollRef: tableRef, storageKey } = useScrollRestoration('validation-table');

    const handleMark = (index: string, isMarked?: boolean) => {
        const updatedResponses = [...codeResponses];
        const response = updatedResponses.find((r) => r.id === index);
        if (response) {
            response.isMarked = isMarked;
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

    useEffect(() => {
        if (tableRef.current && codeResponses.length > 0) {
            const savedPosition = sessionStorage.getItem(storageKey);
            if (savedPosition) {
                tableRef.current.scrollTop = parseInt(savedPosition, 10);
            }
        }
    }, [codeResponses, tableRef, storageKey]);

    const groupedByPostId = useMemo(() => groupByPostId(codeResponses), [codeResponses]);
    const allPostIds = Object.keys(groupedByPostId);

    let totalColumns = 3;
    if (showCoderType && codeResponses.some((row) => 'subCode' in row)) totalColumns += 1;
    if (showThemes && codeResponses.some((row) => 'theme' in row)) totalColumns += 1;
    if (showCoderType && codeResponses.some((row) => 'type' in row)) totalColumns += 1;
    if (!review) totalColumns += 1; // Quick Actions
    if (conflictingResponses.length > 0) totalColumns += 1;

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
                        {currentPostId ? 'visit this transcript' : 'visit transcript'}
                    </button>{' '}
                    to add codes
                </p>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col h-full">
            <div className="flex-1 overflow-y-auto" ref={tableRef}>
                <table className="w-full relative border-separate border-spacing-0">
                    <thead className="sticky top-0 z-30 bg-gray-100">
                        <tr>
                            <th className="max-w-48 p-2 bg-gray-100 border border-gray-300 outline outline-1 outline-gray-300">
                                {codeResponses.some((r) => 'subCode' in r) ? 'Code' : 'Sub-code'}
                            </th>
                            {showCoderType && codeResponses.some((r) => 'subCode' in r) && (
                                <th className="p-2 bg-gray-100 border border-gray-300 outline outline-1 outline-gray-300">
                                    Sub-code
                                </th>
                            )}
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
                                <th className="p-2 bg-gray-100 border border-gray-300 outline outline-1 outline-gray-300 w-28 max-w-28">
                                    Quick Actions
                                    <div className="mt-2 flex justify-center gap-x-2">
                                        <button
                                            title="Select all as correct"
                                            className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 text-sm"
                                            onClick={() => handleToggleAllSelectOrReject(true)}>
                                            ✓
                                        </button>
                                        <button
                                            title="Select all as incorrect"
                                            className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-sm"
                                            onClick={() => handleToggleAllSelectOrReject(false)}>
                                            ✕
                                        </button>
                                    </div>
                                </th>
                            )}
                            {conflictingResponses.length > 0 && (
                                <th className="p-2 bg-gray-100 border border-gray-300 outline outline-1 outline-gray-300">
                                    Conflicts
                                </th>
                            )}
                        </tr>
                    </thead>
                    {allPostIds.map((pid) => (
                        <ObservableTBody
                            key={pid}
                            pid={pid}
                            rowItems={groupedByPostId[pid]}
                            totalColumns={totalColumns}
                            editIndex={editIndex}
                            editableRow={editableRow}
                            handleInputChange={handleInputChange}
                            handleMark={handleMark}
                            handleSaveEdit={handleSaveEdit}
                            handleCancelEdit={handleCancelEdit}
                            review={review}
                            showThemes={showThemes}
                            showCoderType={showCoderType}
                            onViewTranscript={onViewTranscript}
                            conflictingResponses={conflictingResponses}
                        />
                    ))}
                </table>
            </div>
        </div>
    );
};

export default ValidationTable;
