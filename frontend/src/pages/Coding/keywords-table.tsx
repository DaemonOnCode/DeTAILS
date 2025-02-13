import { FC, useEffect, useRef, useState } from 'react';
import { useCodingContext } from '../../context/coding-context';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { FaTrash } from 'react-icons/fa';
import { useCollectionContext } from '../../context/collection-context';
import { MODEL_LIST, REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useNavigate } from 'react-router-dom';
import { saveCSV, saveExcel } from '../../utility/convert-js-object';
import { useLogger } from '../../context/logging-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import getServerUtils from '../../hooks/Shared/get-server-url';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';

const { ipcRenderer } = window.require('electron');

const KeywordsTablePage: FC = () => {
    const { keywordTable, dispatchKeywordsTable, mainTopic, additionalInfo } = useCodingContext();
    const { datasetId } = useCollectionContext();
    const [saving, setSaving] = useState(false);
    const navigate = useNavigate();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = getServerUtils();

    const hasSavedRef = useRef(false);

    const handleGenerateMore = async () => {
        await logger.info('Generate more codes');
        navigate(getCodingLoaderUrl(LOADER_ROUTES.KEYWORD_TABLE_LOADER));
        const filteredKeywordTable = keywordTable.filter((entry) => entry.isMarked === undefined);
        if (keywordTable.length !== 0 && filteredKeywordTable.length === keywordTable.length) {
            navigate('/coding/' + ROUTES.KEYWORD_TABLE);
            await logger.info('KeywordTable Generation completed');
            return;
        }
        // if (!USE_LOCAL_SERVER) {
        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.GENERATE_MORE_CODES), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataset_id: datasetId,
                model: MODEL_LIST.GEMINI_FLASH,
                mainTopic,
                additionalInfo,
                keywordTable,
                currentKeywordTable: filteredKeywordTable.map((entry) => ({
                    word: entry.word,
                    description: entry.description,
                    inclusion_criteria: entry.inclusion_criteria,
                    exclusion_criteria: entry.exclusion_criteria,
                    is_correct: entry.isMarked
                }))
            })
        });
        const results = await res.json();
        console.log(results);

        const newKeywordTable: string[] = results.KeywordTable;

        dispatchKeywordsTable({
            type: 'ADD_MANY',
            entries: newKeywordTable
        });
        await logger.info('KeywordTable Generation completed');
        // }
        navigate('/coding/' + ROUTES.KEYWORD_TABLE);
    };

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
    }, []);

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

    const isReadyCheck = keywordTable.some((entry) => entry.isMarked === true);

    return (
        <div className="flex flex-col justify-between h-full">
            <div className="min-h-maxPageContent">
                <p>Please validate and manage the keyword table entries below:</p>
                <div className="max-h-[calc(100vh-14rem)] overflow-auto mt-4 border border-gray-400 rounded-lg">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-gray-400 p-2">Word</th>
                                <th className="border border-gray-400 p-2">Description</th>
                                {/* <th className="border border-gray-400 p-2">Codes</th> */}
                                <th className="border border-gray-400 p-2">Inclusion Criteria</th>
                                <th className="border border-gray-400 p-2">Exclusion Criteria</th>
                                <>
                                    <th className="p-2 border border-gray-400">
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
                                </>
                                {/* <th className="border border-gray-400 p-2">Comments</th> */}
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
                                                    value: e.target.value.split(',')
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
                                                    value: e.target.value.split(',')
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

                                            {/* Delete Button */}
                                            <button
                                                className="w-8 h-8 flex items-center justify-center bg-red-600 text-white rounded hover:bg-red-700"
                                                onClick={() =>
                                                    dispatchKeywordsTable({
                                                        type: 'DELETE_ROW',
                                                        index
                                                    })
                                                }>
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-6 flex justify-center gap-x-48">
                    <div className="flex gap-x-4">
                        <button
                            onClick={() => dispatchKeywordsTable({ type: 'ADD_ROW' })}
                            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                            Add New Row
                        </button>
                        {/* <button
                            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                            onClick={handleGenerateMore}>
                            Generate more
                        </button> */}
                    </div>
                    <div className="flex gap-x-4">
                        <button
                            onClick={handleSaveCsv}
                            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                            disabled={saving}>
                            Save as CSV
                        </button>
                        <button
                            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                            onClick={handleSaveExcel}
                            disabled={saving}>
                            Save as Excel
                        </button>
                    </div>
                </div>
            </div>
            <NavigationBottomBar
                previousPage={`${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`}
                nextPage={ROUTES.LOAD_DATA}
                isReady={isReadyCheck}
            />
        </div>
    );
};

export default KeywordsTablePage;
