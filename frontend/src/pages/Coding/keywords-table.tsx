import { FC, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer, toast, ToastContentProps } from 'react-toastify';
import { FaTrash } from 'react-icons/fa';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { ROUTES } from '../../constants/Coding/shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useCodingContext } from '../../context/coding-context';
import { useCollectionContext } from '../../context/collection-context';
import { useLogger } from '../../context/logging-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { saveCSV, saveExcel } from '../../utility/convert-js-object';
import { KeywordEntry } from '../../types/Coding/shared';
import UndoNotification from '../../components/Shared/undo-toast';
import CustomTutorialOverlay, {
    TutorialStep
} from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { useLoadingContext } from '../../context/loading-context';

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
    const location = useLocation();

    const steps: TutorialStep[] = [
        {
            target: '#keywords-header',
            content:
                'Welcome to the Keywords Table page. Here you can review and edit your keyword entries.',
            placement: 'bottom'
        },
        {
            target: '#table-section',
            content: 'Review your keywords below. You can edit each field directly in the table.',
            placement: 'bottom'
        },
        {
            target: '#control-buttons',
            content: 'Use these buttons to add new rows or save your table as CSV/Excel.',
            placement: 'top'
        },
        {
            target: '#proceed-next-step',
            content: 'Proceed to next step',
            placement: 'top'
        }
    ];

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

    // useImperativeHandle(
    //     loadingState[location.pathname].stepRef,
    //     () => ({
    //         validateStep: () => {
    //             // if (selectedKeywords.length < WORD_CLOUD_MIN_THRESHOLD) {
    //             //     alert(`Please select at least ${WORD_CLOUD_MIN_THRESHOLD} keywords.`);
    //             //     return false;
    //             // }
    //             return true;
    //         },
    //         resetStep: () => {
    //             // dispatchKeywordsTable({
    //             //     type:"INITIALIZE",
    //             // })
    //         }
    //     }),
    //     [keywordTable]
    // );

    // // Register this step's ref in your loading state.
    // useEffect(() => {
    //     registerStepRef(stepRoute, loadingState[location.pathname].stepRef);
    // }, [loadingState[location.pathname].stepRef, stepRoute]);

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
        <>
            <TutorialWrapper
                steps={steps}
                pageId={location.pathname}
                excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}`}>
                <div className="h-page flex flex-col">
                    <header id="keywords-header" className="flex-none py-4">
                        <p>Please validate and manage the keyword table entries below:</p>
                    </header>

                    <main className="flex-1 overflow-hidden flex flex-col">
                        {/* Table container */}
                        <div
                            id="table-section"
                            className="flex-1 overflow-auto relative"
                            ref={tableContainerRef}>
                            <table className="w-full border-separate border-spacing-0">
                                <thead className="sticky top-0">
                                    <tr className="bg-gray-200">
                                        <th className="border border-gray-400 p-2">Word</th>
                                        <th className="border border-gray-400 p-2">Description</th>
                                        <th className="border border-gray-400 p-2">
                                            Inclusion Criteria
                                        </th>
                                        <th className="border border-gray-400 p-2">
                                            Exclusion Criteria
                                        </th>
                                        <th className="border border-gray-400 p-2">
                                            Actions
                                            <div className="mt-2 flex justify-center gap-x-2">
                                                <button
                                                    title="Select all as correct"
                                                    className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 text-sm"
                                                    onClick={() =>
                                                        handleToggleAllSelectOrReject(true)
                                                    }>
                                                    ✓
                                                </button>
                                                <button
                                                    title="Select all as incorrect"
                                                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-sm"
                                                    onClick={() =>
                                                        handleToggleAllSelectOrReject(false)
                                                    }>
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
                    </main>

                    {/* Control buttons */}
                    <div id="control-buttons" className="mt-3 lg:mt-6 flex justify-evenly">
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

                    <footer id="bottom-navigation" className="flex-none">
                        <NavigationBottomBar
                            previousPage={`${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`}
                            nextPage={`${ROUTES.LOAD_DATA}/${ROUTES.DATA_SOURCE}`}
                            isReady={isReadyCheck}
                            disabledTooltipText="Mark at least one entry as correct"
                        />
                    </footer>
                </div>
            </TutorialWrapper>
        </>
    );
};

export default KeywordsTablePage;
