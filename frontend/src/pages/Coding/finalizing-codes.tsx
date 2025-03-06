import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import UnplacedCodesBox from '../../components/Coding/Themes/unplaced-box';
import ReviewToggle from '../../components/Coding/UnifiedCoding/review-toggle';
import ValidationTable from '../../components/Coding/UnifiedCoding/validation-table';
import Bucket from '../../components/Coding/Themes/bucket';
import { useCodingContext } from '../../context/coding-context';
import { DetailsLLMIcon } from '../../components/Shared/Icons';
import { useCollectionContext } from '../../context/collection-context';
import { useLoadingContext } from '../../context/loading-context';
import { useSettings } from '../../context/settings-context';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { useApi } from '../../hooks/Shared/use-api';
import { useLogger } from '../../context/logging-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { createTimer } from '../../utility/timer';
import { getGroupedCodeOfSubCode } from '../../utility/theme-finder';

const FinalzingCodes = () => {
    const location = useLocation();

    const {
        sampledPostResponse,
        unseenPostResponse,
        groupedCodes,
        setGroupedCodes,
        unplacedSubCodes,
        setUnplacedSubCodes,
        setThemes,
        setUnplacedCodes
    } = useCodingContext();
    const { loadingState, registerStepRef, loadingDispatch } = useLoadingContext();
    const { datasetId } = useCollectionContext();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const { fetchData } = useApi();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);
    // State for toggling review vs. edit mode
    const [review, setReview] = useState(true);

    const stepRoute = location.pathname;

    // Handler for dropping a code into a bucket
    const handleDropToBucket = (bucketId: string, code: string) => {
        setGroupedCodes((prevBuckets) =>
            prevBuckets.map((bucket) => {
                if (bucket.id === bucketId) {
                    // Add code if it isn't already in the bucket
                    if (!bucket.codes.includes(code)) {
                        return { ...bucket, codes: [...bucket.codes, code] };
                    }
                } else {
                    // Ensure code is removed from all other buckets
                    return { ...bucket, codes: bucket.codes.filter((c) => c !== code) };
                }
                return bucket;
            })
        );
        setUnplacedSubCodes((prevCodes) => prevCodes.filter((c) => c !== code));
    };

    // Handler for dropping a code back into the unplaced box
    const handleDropToUnplaced = (code: string) => {
        setUnplacedSubCodes((prevCodes) =>
            prevCodes.includes(code) ? prevCodes : [...prevCodes, code]
        );
        setGroupedCodes((prevBuckets) =>
            prevBuckets.map((bucket) => ({
                ...bucket,
                codes: bucket.codes.filter((c) => c !== code)
            }))
        );
    };

    // Add a new bucket for codes
    const handleAddBucket = () => {
        const newBucket = {
            id: (groupedCodes.length + 1).toString(),
            name: 'New Group',
            codes: []
        };
        setGroupedCodes([...groupedCodes, newBucket]);
    };

    // Delete a bucket and move its codes to unplaced
    const handleDeleteBucket = (bucketId: string) => {
        const bucketToDelete = groupedCodes.find((bucket) => bucket.id === bucketId);
        if (bucketToDelete) {
            setUnplacedSubCodes((prevCodes) => [...prevCodes, ...bucketToDelete.codes]);
        }
        setGroupedCodes((prevBuckets) => prevBuckets.filter((bucket) => bucket.id !== bucketId));
    };

    // Placeholder for next button click
    const handleNextClick = async () => {
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`
        });
        navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_GENERATION_LOADER));

        const { data: results, error } = await fetchData<{
            message: string;
            data: {
                themes: any[];
                unplaced_codes: any[];
            };
        }>(REMOTE_SERVER_ROUTES.THEME_GENERATION, {
            method: 'POST',
            body: JSON.stringify({
                dataset_id: datasetId,
                model: settings.ai.model,
                unseen_post_responses: unseenPostResponse.map((r) => ({
                    postId: r.postId,
                    id: r.id,
                    code: getGroupedCodeOfSubCode(r.code, groupedCodes),
                    quote: r.quote,
                    explanation: r.explanation,
                    comment: r.comment,
                    subCode: r.code
                })),
                sampled_post_responses: sampledPostResponse.map((r) => ({
                    postId: r.postId,
                    id: r.id,
                    code: getGroupedCodeOfSubCode(r.code, groupedCodes),
                    quote: r.quote,
                    explanation: r.explanation,
                    comment: r.comment,
                    subCode: r.code
                }))
            })
        });

        if (error) {
            console.error('Error in handleNextClick:', error);
            loadingDispatch({
                type: 'SET_LOADING_DONE_ROUTE',
                route: `/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`
            });
            return;
        }
        console.log('Results:', results);

        setThemes(results.data.themes.map((theme: any) => ({ ...theme, name: theme.theme })));
        setUnplacedCodes(results.data.unplaced_codes);
        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`
        });
    };

    const handleRefreshCodes = async () => {
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.FINALIZING_CODES}`
        });
        navigate(getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER));

        const { data: results, error } = await fetchData<{
            message: string;
            data: {
                higher_level_codes: any[];
                unplaced_codes: any[];
            };
        }>(REMOTE_SERVER_ROUTES.GROUP_CODES, {
            method: 'POST',
            body: JSON.stringify({
                dataset_id: datasetId,
                model: settings.ai.model,
                unseen_post_responses: unseenPostResponse,
                sampled_post_responses: sampledPostResponse
            })
        });

        if (error) {
            console.error('Error refreshing themes:', error);
            loadingDispatch({
                type: 'SET_LOADING_DONE_ROUTE',
                route: `/${SHARED_ROUTES.CODING}/${ROUTES.FINALIZING_CODES}`
            });
            return;
        }

        console.log('Results:', results);
        setGroupedCodes(results.data.higher_level_codes);
        setUnplacedSubCodes(results.data.unplaced_codes);

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.FINALIZING_CODES}`
        });
        navigate(`/${SHARED_ROUTES.CODING}/${ROUTES.FINALIZING_CODES}`);
    };

    useEffect(() => {
        if (loadingState[stepRoute]?.isLoading) {
            navigate(getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER));
        }
    }, []);

    useEffect(() => {
        const timer = createTimer();
        logger.info('Themes Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Themes Page Unloaded').then(() => {
                logger.time('Themes Page stay time', { time: timer.end() });
            });
        };
    }, []);

    // Optionally add tutorial steps if needed
    const steps: TutorialStep[] = [
        {
            target: '#finalized-main',
            content: 'This is the finalizing codes page. Here you can review and edit your codes.',
            placement: 'bottom'
        },
        {
            target: '#review-edit-toggle',
            content:
                'Click this button to toggle between review, where you can analyze the LLM generated codes and edit mode, where you can update the higher level codes formed from sub codes.',
            placement: 'bottom'
        },
        {
            target: '#finalized-code-table',
            content:
                'This table displays all the code responses. You can review the codes and their responses here.',
            placement: 'top'
        },
        {
            target: '#proceed-next-step',
            content: 'Step 4: Proceed to next step',
            placement: 'top'
        }
    ];

    return (
        <TutorialWrapper
            steps={steps}
            pageId={location.pathname}
            excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${ROUTES.FINALIZING_CODES}`}>
            <main className="h-page flex flex-col" id="finalized-main">
                {/* Toggle at the top (Review vs. Edit) */}
                <ReviewToggle review={review} setReview={setReview} />
                {/* <div className="flex-1 overflow-hidden"> */}
                {review ? (
                    // REVIEW MODE: Display a table with code responses (adjust prop names as needed)
                    <div className="flex-1 overflow-auto pb-6" id="finalized-code-table">
                        <ValidationTable
                            codeResponses={[
                                ...sampledPostResponse.map((r) => ({
                                    postId: r.postId,
                                    id: r.id,
                                    code: getGroupedCodeOfSubCode(r.code, groupedCodes),
                                    quote: r.quote,
                                    explanation: r.explanation,
                                    comment: r.comment,
                                    subCode: r.code
                                })),
                                ...unseenPostResponse.map((r) => {
                                    return {
                                        postId: r.postId,
                                        id: r.id,
                                        code: getGroupedCodeOfSubCode(r.code, groupedCodes),
                                        quote: r.quote,
                                        explanation: r.explanation,
                                        comment: r.comment,
                                        subCode: r.code
                                    };
                                })
                            ]} // You may need to adjust this based on your data shape
                            onViewTranscript={() => {}}
                            dispatchCodeResponses={() => {}}
                            onReRunCoding={() => {}}
                            onUpdateResponses={() => {}}
                            review={true}
                        />
                    </div>
                ) : (
                    // EDIT MODE: Show bucket interface for codes with drag and drop
                    <>
                        <div className="flex-1 overflow-auto pb-6">
                            <DndProvider backend={HTML5Backend} context={window}>
                                <div className="container mx-auto">
                                    <div className="grid grid-cols-3 gap-6">
                                        {groupedCodes.map((bucket) => (
                                            <Bucket
                                                key={bucket.id}
                                                theme={bucket}
                                                onDrop={handleDropToBucket}
                                                onDelete={handleDeleteBucket}
                                            />
                                        ))}
                                    </div>
                                    <UnplacedCodesBox
                                        unplacedCodes={unplacedSubCodes}
                                        onDrop={handleDropToUnplaced}
                                    />
                                </div>
                            </DndProvider>
                        </div>
                        <div className="pt-4 flex justify-between">
                            <button
                                onClick={handleAddBucket}
                                className="px-4 py-2 bg-blue-500 text-white rounded">
                                + Add New Code
                            </button>
                            <button
                                id="refresh-themes-button"
                                onClick={handleRefreshCodes}
                                className="px-4 py-2 bg-gray-600 text-white rounded flex justify-center items-center gap-2">
                                <DetailsLLMIcon className="h-6 w-6" />
                                Redo grouping
                            </button>
                        </div>
                    </>
                )}
                {/* </div> */}

                {/* Navigation at the bottom */}
                <NavigationBottomBar
                    previousPage={`${ROUTES.DEDUCTIVE_CODING}`}
                    nextPage={`${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`}
                    isReady={unplacedSubCodes.length === 0}
                    onNextClick={handleNextClick}
                />
            </main>
        </TutorialWrapper>
    );
};

export default FinalzingCodes;
