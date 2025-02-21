import { FC, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast, ToastContentProps } from 'react-toastify';
import { FaTrash } from 'react-icons/fa';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useCollectionContext } from '../../context/collection-context';
import { useLogger } from '../../context/logging-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { saveCSV, saveExcel } from '../../utility/convert-js-object';
import { KeywordEntry } from '../../types/Coding/shared';
import UndoNotification from '../../components/Shared/undo-toast';

const { ipcRenderer } = window.require('electron');

const KeywordsTablePage: FC = () => {
    const { keywordTable, dispatchKeywordsTable } = useCodingContext();
    const { datasetId } = useCollectionContext();
    const [saving, setSaving] = useState(false);

    const navigate = useNavigate();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = useServerUtils();

    const hasSavedRef = useRef(false);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const handleSaveCsv = async () => {
        await logger.info('Saving KeywordTable as CSV');
        setSaving(true);
        const result = await saveCSV(ipcRenderer, keywordTable, 'KeywordTable');
        console.log(result);
        setSaving(false);
        await logger.info('KeywordTable saved as CSV');
    };

    const handleSaveExcel = async () => {
        await logger.info('Saving KeywordTable as Excel');
        setSaving(true);
        const result = await saveExcel(ipcRenderer, keywordTable, 'KeywordTable');
        console.log(result);
        setSaving(false);
        await logger.info('KeywordTable saved as Excel');
    };

    useEffect(() => {
        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
    }, [saveWorkspaceData]);

    const handleToggleAllSelectOrReject = (isSelect: boolean) => {
        const allAlreadySetTo = keywordTable.every((r) => r.isMarked === isSelect);
        const finalDecision = allAlreadySetTo ? undefined : isSelect;

        if (finalDecision === undefined) {
            dispatchKeywordsTable({ type: 'SET_ALL_UNMARKED' });
        } else {
            dispatchKeywordsTable({
                type: finalDecision ? 'SET_ALL_CORRECT' : 'SET_ALL_INCORRECT'
            });
        }
    };

    const handleAddNewRow = () => {
        dispatchKeywordsTable({ type: 'ADD_ROW' });
        setTimeout(() => {
            if (tableContainerRef.current) {
                tableContainerRef.current.scrollTo({
                    top: tableContainerRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            }
        }, 500);
    };

    const handleDeleteRow = (index: number) => {
        const rowToRemove = keywordTable[index];

        dispatchKeywordsTable({ type: 'DELETE_ROW', index });
        console.log(rowToRemove, 'row');

        toast.info(<UndoNotification />, {
            autoClose: 5000,
            closeButton: false,
            data: {
                onUndo: () => handleUndoDelete(rowToRemove, index)
            },
            onClose: (closedByUser) => {
                if (closedByUser) return;
            }
        });
    };

    const handleUndoDelete = (row: KeywordEntry, index: number) => {
        dispatchKeywordsTable({
            type: 'UNDO_DELETE_ROW',
            entry: row,
            index
        });
    };

    const isReadyCheck = keywordTable.some((entry) => entry.isMarked === true);

    return (
        <div className="h-page flex flex-col">
            <header className="flex-none py-4">
                <p>Please validate and manage the keyword table entries below:</p>
            </header>

            <main className="flex-1 overflow-hidden flex flex-col">
                {/* Table container */}
                <div className="flex-1 overflow-auto" ref={tableContainerRef}>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-gray-400 p-2">Word</th>
                                <th className="border border-gray-400 p-2">Description</th>
                                <th className="border border-gray-400 p-2">Inclusion Criteria</th>
                                <th className="border border-gray-400 p-2">Exclusion Criteria</th>
                                <th className="border border-gray-400 p-2">
                                    Actions
                                    <div className="mt-2 flex justify-center gap-x-2">
                                        <button
                                            className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 text-sm"
                                            onClick={() => handleToggleAllSelectOrReject(true)}>
                                            ✓
                                        </button>
                                        <button
                                            className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-sm"
                                            onClick={() => handleToggleAllSelectOrReject(false)}>
                                            ✕
                                        </button>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {keywordTable.map((entry, index) => (
                                <tr key={index} className="text-center">
                                    <td className="border border-gray-400 p-2">
                                        <textarea
                                            className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                                            value={entry.word}
                                            onChange={(e) =>
                                                dispatchKeywordsTable({
                                                    type: 'UPDATE_FIELD',
                                                    index,
                                                    field: 'word',
                                                    value: e.target.value
                                                })
                                            }
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <textarea
                                            className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                                            value={entry.description}
                                            onChange={(e) =>
                                                dispatchKeywordsTable({
                                                    type: 'UPDATE_FIELD',
                                                    index,
                                                    field: 'description',
                                                    value: e.target.value
                                                })
                                            }
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <textarea
                                            className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                                            value={entry.inclusion_criteria.join(', ')}
                                            onChange={(e) =>
                                                dispatchKeywordsTable({
                                                    type: 'UPDATE_FIELD',
                                                    index,
                                                    field: 'inclusion_criteria',
                                                    // split on comma, trim spaces
                                                    value: e.target.value
                                                        .split(',')
                                                        .map((v) => v.trim())
                                                })
                                            }
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <textarea
                                            className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                                            value={entry.exclusion_criteria.join(', ')}
                                            onChange={(e) =>
                                                dispatchKeywordsTable({
                                                    type: 'UPDATE_FIELD',
                                                    index,
                                                    field: 'exclusion_criteria',
                                                    value: e.target.value
                                                        .split(',')
                                                        .map((v) => v.trim())
                                                })
                                            }
                                        />
                                    </td>
                                    <td className="border border-gray-400 p-2">
                                        <div className="flex items-center justify-center space-x-2">
                                            {/* Correct Button */}
                                            <button
                                                className={`w-8 h-8 flex items-center justify-center rounded ${
                                                    entry.isMarked === true
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-gray-300 text-gray-500'
                                                }`}
                                                onClick={() =>
                                                    dispatchKeywordsTable({
                                                        type: 'TOGGLE_MARK',
                                                        index,
                                                        isMarked:
                                                            entry.isMarked !== true
                                                                ? true
                                                                : undefined
                                                    })
                                                }>
                                                ✓
                                            </button>

                                            {/* Incorrect Button */}
                                            <button
                                                className={`w-8 h-8 flex items-center justify-center rounded ${
                                                    entry.isMarked === false
                                                        ? 'bg-red-500 text-white'
                                                        : 'bg-gray-300 text-gray-500'
                                                }`}
                                                onClick={() =>
                                                    dispatchKeywordsTable({
                                                        type: 'TOGGLE_MARK',
                                                        index,
                                                        isMarked:
                                                            entry.isMarked !== false
                                                                ? false
                                                                : undefined
                                                    })
                                                }>
                                                ✕
                                            </button>

                                            {/* Soft-Delete Button (with undo) */}
                                            <button
                                                className="w-8 h-8 flex items-center justify-center bg-red-600 text-white rounded hover:bg-red-700"
                                                onClick={() => handleDeleteRow(index)}>
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Control buttons below the table */}
                <div className="mt-3 lg:mt-6 flex justify-evenly">
                    <div className="flex gap-x-4">
                        <button
                            onClick={handleAddNewRow}
                            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                            Add New Row
                        </button>
                    </div>
                    <div className="flex gap-x-4">
                        <button
                            onClick={handleSaveCsv}
                            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                            disabled={saving}>
                            Save as CSV
                        </button>
                        <button
                            onClick={handleSaveExcel}
                            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                            disabled={saving}>
                            Save as Excel
                        </button>
                    </div>
                </div>
            </main>

            {/* Bottom Navigation */}
            <footer className="flex-none">
                <NavigationBottomBar
                    previousPage={`${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`}
                    nextPage={`${ROUTES.LOAD_DATA}/${ROUTES.HOME}`}
                    isReady={isReadyCheck}
                />
            </footer>
        </div>
    );
};

export default KeywordsTablePage;
