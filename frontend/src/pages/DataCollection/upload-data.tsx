import React from 'react';
import { useCollectionContext } from '../../context/collection-context';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LoadInterview from './load-interviews';
import LoadReddit from './load-reddit';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { LOADER_ROUTES, ROUTES, SELECTED_POSTS_MIN_THRESHOLD } from '../../constants/Coding/shared';
import { REMOTE_SERVER_ROUTES, MODEL_LIST } from '../../constants/Shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { Link } from 'react-router-dom';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';

const UploadDataPage = () => {
    const { type, datasetId, selectedData, modeInput } = useCollectionContext();

    const [searchParams] = useSearchParams();

    const datasetType = searchParams.get('type') ?? modeInput.split(':')[0];
    console.log('Search params:', searchParams, searchParams.get('type'));
    const navigate = useNavigate();
    const {
        setSampledPostIds,
        setUnseenPostIds,
        keywordTable,
        mainTopic,
        additionalInfo,
        researchQuestions,
        dispatchSampledPostResponse
    } = useCodingContext();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = useServerUtils();

    const postIds: string[] = selectedData;

    const isReadyCheck = postIds.length >= SELECTED_POSTS_MIN_THRESHOLD;

    const handleSamplingPosts = async () => {
        if (!datasetId) return;
        // Navigate to the codebook loader page.
        navigate(getCodingLoaderUrl(LOADER_ROUTES.CODEBOOK_LOADER));
        console.log('Sampling posts:', postIds);

        // Sample posts from the backend.
        let res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.SAMPLE_POSTS), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ dataset_id: datasetId, post_ids: postIds })
        });

        let results = await res.json();
        console.log('Results:', results);

        setSampledPostIds(results['sampled']);
        setUnseenPostIds(results['unseen']);

        console.log(
            'Generate initial codes:',
            results['sampled'],
            keywordTable.filter((keyword) => keyword.isMarked !== undefined)
        );
        res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.GENERATE_INITIAL_CODES), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataset_id: datasetId,
                keyword_table: keywordTable.filter((keyword) => keyword.isMarked !== undefined),
                model: MODEL_LIST.GEMINI_FLASH,
                main_topic: mainTopic,
                additional_info: additionalInfo,
                research_questions: researchQuestions,
                sampled_post_ids: results['sampled'] ?? []
            })
        });

        results = await res.json();
        console.log('Results:', results);

        dispatchSampledPostResponse({
            type: 'SET_RESPONSES',
            responses: results['data']
        });
    };

    // If no type is selected, prompt user to go back to home
    if (!type) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <p className="text-xl mb-4">
                    No data type selected. Please return to the home page to select a type.
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="px-4 py-2 bg-blue-500 text-white rounded">
                    Go Home
                </button>
            </div>
        );
    }

    return (
        <div className="h-page flex flex-col">
            {/* <header className="p-4 bg-gray-100">
                <h1 className="text-2xl font-bold">
                    {type === 'reddit' ? 'Reddit Data Upload' : 'Interview Data Upload'}
                </h1>
            </header> */}
            <main className="flex-1 overflow-hidden">
                {datasetType === 'reddit' ? (
                    <LoadReddit />
                ) : datasetType === 'interview' ? (
                    <LoadInterview />
                ) : (
                    <div className="flex flex-col items-center justify-center h-maxPageContent">
                        <p>Choose what type of data to retrieve from home page</p>
                        <Link
                            to={`/coding/${ROUTES.LOAD_DATA}/${ROUTES.HOME}`}
                            className="text-blue-500">
                            Go back to Data selection
                        </Link>
                    </div>
                )}
            </main>
            <footer>
                <NavigationBottomBar
                    previousPage={`${ROUTES.LOAD_DATA}/${ROUTES.HOME}`}
                    nextPage={ROUTES.CODEBOOK_CREATION}
                    isReady={isReadyCheck}
                    onNextClick={handleSamplingPosts}
                />
            </footer>
        </div>
    );
};

export default UploadDataPage;
