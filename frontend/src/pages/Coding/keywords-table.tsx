import { FC, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { PAGE_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useCodingContext } from '../../context/coding-context';
import { useCollectionContext } from '../../context/collection-context';
import { useLogger } from '../../context/logging-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { saveCSV, saveExcel } from '../../utility/convert-js-object';
import { KeywordEntry } from '../../types/Coding/shared';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { useLoadingContext } from '../../context/loading-context';
import { useUndo } from '../../hooks/Shared/use-undo';
import useScrollRestoration from '../../hooks/Shared/use-scroll-restoration';
import KeywordTableRow from '../../components/Coding/KeywordTable/keyword-table-row';

const { ipcRenderer } = window.require('electron');

const KeywordsTablePage: FC = () => {
    const { keywordTable, dispatchKeywordsTable } = useCodingContext();
    const { datasetId } = useCollectionContext();
    const [saving, setSaving] = useState(false);
    const { loadingState } = useLoadingContext();
    const { performWithUndoForReducer } = useUndo(); // Hook providing performWithUndoForReducer

    const navigate = useNavigate();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = useServerUtils();

    const hasSavedRef = useRef(false);
    const location = useLocation();

    const steps = [
        {
            target: '#keywords-header',
            content:
                'Welcome to the Keywords Table page. Here you can review and edit your keyword entries.',
            placement: 'bottom'
        },
        {
            target: '#table-section',
            content:
                'Review your keywords above. You can edit each field directly in the table if you wish to make changes.',
            placement: 'bottom'
        },
        {
            target: '#action-row-0',
            content:
                'Use these buttons to filter out which rows are to be used to further building the context for deductive coding.',
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
        toast.success('Keyword Table saved as CSV');
        await logger.info('KeywordTable saved as CSV');
    };

    const handleSaveExcel = async () => {
        await logger.info('Saving KeywordTable as Excel');
        setSaving(true);
        const result = await saveExcel(ipcRenderer, keywordTable, 'KeywordTable');
        console.log(result);
        setSaving(false);
        toast.success('Keyword Table saved as Excel');
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

    const { scrollRef: tableRef, storageKey } = useScrollRestoration('keyword-table');

    useEffect(() => {
        if (tableRef.current && keywordTable.length > 0) {
            const savedPosition = sessionStorage.getItem(storageKey);
            if (savedPosition) {
                tableRef.current.scrollTop = parseInt(savedPosition, 10);
            }
        }
    }, [keywordTable, tableRef, storageKey]);

    // Handler for text field changes with undo support
    const onFieldChange = (index: number, field: string, value: any) => {
        const action = { type: 'UPDATE_FIELD', index, field, value };
        performWithUndoForReducer(keywordTable, dispatchKeywordsTable, action);
    };

    // Handler for toggling mark with undo support
    const onToggleMark = (index: number, isMarked: boolean | undefined) => {
        const action = { type: 'TOGGLE_MARK', index, isMarked };
        performWithUndoForReducer(keywordTable, dispatchKeywordsTable, action);
    };

    // Handler for deleting a row with undo support
    const onDeleteRow = (index: number) => {
        const action = { type: 'DELETE_ROW', index };
        performWithUndoForReducer(keywordTable, dispatchKeywordsTable, action);
    };

    // Handler for toggling all rows with undo support
    const handleToggleAllSelectOrReject = (isSelect: boolean) => {
        const allAlreadySetTo = keywordTable.every((r) => r.isMarked === isSelect);
        const finalDecision = allAlreadySetTo ? undefined : isSelect;

        let action;
        if (finalDecision === undefined) {
            action = { type: 'SET_ALL_UNMARKED' };
        } else {
            action = { type: finalDecision ? 'SET_ALL_CORRECT' : 'SET_ALL_INCORRECT' };
        }
        performWithUndoForReducer(keywordTable, dispatchKeywordsTable, action);
    };

    // Handler for adding a new row with undo support
    const handleAddNewRow = () => {
        const action = { type: 'ADD_ROW' };
        performWithUndoForReducer(keywordTable, dispatchKeywordsTable, action);
        setTimeout(() => {
            if (tableRef.current) {
                tableRef.current.scrollTo({
                    top: tableRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            }
        }, 500);
    };

    if (loadingState[location.pathname]?.isFirstRun) {
        return (
            <p className="h-page w-full flex justify-center items-center">
                Please complete the previous page and click on proceed to continue with this page.
            </p>
        );
    }

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
                        <div
                            id="table-section"
                            className="flex-1 overflow-auto relative"
                            ref={tableRef}>
                            <table className="w-full border-separate border-spacing-0">
                                <thead className="sticky top-0">
                                    <tr className="bg-gray-200">
                                        <th className="border border-gray-400 p-2">Word</th>
                                        <th className="border border-gray-400 p-2">Description</th>
                                        <th className="border border-gray-400 p-2">
                                            inclusion Criteria
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
                                        <KeywordTableRow
                                            key={index}
                                            entry={entry}
                                            index={index}
                                            onFieldChange={onFieldChange}
                                            onToggleMark={onToggleMark}
                                            onDeleteRow={onDeleteRow}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </main>

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
                            previousPage={PAGE_ROUTES.KEYWORD_CLOUD}
                            nextPage={PAGE_ROUTES.DATA_TYPE}
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
