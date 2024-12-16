import { useEffect } from 'react';
import FileCard from '../../components/Coding/Shared/file_card';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useNavigate } from 'react-router-dom';
import { useLogger } from '../../context/logging_context';
import { MODEL_LIST, REMOTE_SERVER_BASE_URL, REMOTE_SERVER_ROUTES, USE_LOCAL_SERVER } from '../../constants/Shared';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding_context';
import { useCollectionContext } from '../../context/collection_context';

const fs = window.require('fs');
const { ipcRenderer } = window.require('electron');

const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];

const BasisPage = () => {
    const navigate = useNavigate();
    const logger = useLogger();

    const { basisFiles, addBasisFile, mainCode, additionalInfo, setAdditionalInfo, setMainCode, removeBasisFile, setThemes} =
        useCodingContext();

    const { datasetId } = useCollectionContext();

    const checkIfReady = Object.keys(basisFiles).length > 0 && mainCode.length > 0;

    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Basis Page');

        return () => {
            logger.info('Unloaded Basis Page').then(() => {
                logger.time('Basis Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const handleSelectFiles = async () => {
        const files: {
            filePath: string;
            fileName: string;
        }[] = await ipcRenderer.invoke('select-files'); // Access through preload
        if (!files || files.length === 0) return;

        // Filter files based on allowed extensions
        const filteredFiles = files.filter(({ fileName }) =>
            validExtensions.some((ext) => fileName.toLowerCase().endsWith(ext))
        );

        if (filteredFiles.length === 0) {
            alert('No valid files selected. Please select files with valid extensions.');
            return;
        }

        // Pass the selected files to the parent or context
        filteredFiles.forEach(({ filePath, fileName }) => {
            addBasisFile(filePath, fileName);
        });
    };

    const handleOnNextClick = async (e: any) => {
        e.preventDefault();
        await logger.info('Starting Theme Cloud Generation');
        navigate('../loader/' + LOADER_ROUTES.THEME_LOADER);

        console.log('Sending request to server');
        if (!USE_LOCAL_SERVER){
            console.log('Sending request to remote server');
            const formData = new FormData();
            Object.keys(basisFiles).forEach((filePath) => {
                const fileContent = fs.readFileSync(filePath);
                const blob = new Blob([fileContent]);
                formData.append('basisFiles', blob, basisFiles[filePath]);
            });
            formData.append('model', MODEL_LIST.LLAMA_3_2);
            formData.append('mainCode', mainCode);
            formData.append('additionalInfo', additionalInfo ?? "");
            formData.append('retry', 'false');
            formData.append('dataset_id', datasetId);

            // await ipcRenderer.invoke("connect-ws", datasetId);
            let res = await fetch(`${REMOTE_SERVER_BASE_URL}/${REMOTE_SERVER_ROUTES.ADD_DOCUMENTS_AND_GET_THEMES}`, {
                method: 'POST',
                body: formData
            });
            let results:{
                message: string;
                themes: string[];
            } = await res.json();
            console.log('Response from remote server', results);

            if(results.themes.length > 0){
                setThemes(Array.from(new Set(results.themes)));
            }

            // await ipcRenderer.invoke("disconnect-ws", datasetId);
            await logger.info('Theme Cloud generated');
            return;
        }



        console.log('Ending function');
    };

    return (
        <div className="w-full h-full flex justify-between flex-col">
            <div>
                <section className="">
                    {Object.keys(basisFiles).length === 0 ? (
                        <>
                            <h1>Select basis pdfs</h1>
                            <button
                                onClick={handleSelectFiles}
                                className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                                Select Files
                            </button>
                        </>
                    ) : (
                        <>
                            <h1>Selected basis files</h1>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 py-10">
                                {Object.keys(basisFiles).map((filePath, index) => (
                                    <FileCard
                                        key={index}
                                        filePath={filePath}
                                        fileName={basisFiles[filePath]}
                                        onRemove={removeBasisFile}
                                    />
                                ))}
                                <label
                                    className="flex items-center justify-center h-32 w-32 border rounded shadow-lg bg-white p-4 cursor-pointer text-blue-500 font-semibold hover:bg-blue-50"
                                    onClick={handleSelectFiles}>
                                    <span>+ Add File</span>
                                    {/* <button
                                        onClick={handleSelectFiles}
                                        className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                                        Select Files
                                    </button> */}
                                </label>
                            </div>
                        </>
                    )}
                </section>
                <div>
                    <p>Main Code:</p>
                    <input
                        type="text"
                        className="p-2 border border-gray-300 rounded w-96"
                        value={mainCode}
                        onChange={(e) => setMainCode(e.target.value)}
                    />
                </div>
                <div>
                    <p>Provide some additional information about main code:</p>
                    <textarea
                        className="p-2 border border-gray-300 rounded w-96"
                        value={additionalInfo}
                        onChange={(e) => setAdditionalInfo(e.target.value)}
                    />
                </div>
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.HOME}
                nextPage={ROUTES.THEME_CLOUD}
                isReady={checkIfReady}
                onNextClick={handleOnNextClick}
            />
        </div>
    );
};

export default BasisPage;
