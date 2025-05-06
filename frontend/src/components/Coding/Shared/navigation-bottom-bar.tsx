import { FC } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { NavigationBottomBarProps } from '../../../types/Coding/props';
import { TooltipMessages } from '../../../constants/Shared';
import { useLoadingContext } from '../../../context/loading-context';

const NavigationBottomBar: FC<NavigationBottomBarProps> = ({
    isReady,
    previousPage,
    nextPage,
    onNextClick,
    autoNavigateToNext = true,
    onPreviousClick,
    disabledTooltipText
}) => {
    const location = useLocation();
    const navigate = useNavigate();

    const { resetDataAfterPage, loadingDispatch, abortRequests, checkIfDataExists, openModal } =
        useLoadingContext();

    return (
        <div className="flex justify-between mt-6">
            <Link
                to={previousPage || ''}
                id="back-previous-step"
                title={TooltipMessages.PreviousStep}
                className={`${
                    previousPage === undefined && 'invisible'
                } px-2 lg:px-4 py-2 rounded transition duration-200 bg-blue-500 text-white hover:bg-blue-600`}
                onClick={(e) => {
                    if (!previousPage) e.preventDefault();
                    else onPreviousClick && onPreviousClick();
                }}>
                ← Go back
            </Link>
            {nextPage && (
                <Link
                    to={nextPage}
                    id="proceed-next-step"
                    title={isReady ? TooltipMessages.NextStep : disabledTooltipText}
                    className={`px-2 lg:px-4 py-2 rounded transition duration-200 ${
                        isReady
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    }`}
                    onClick={async (e) => {
                        e.preventDefault();
                        if (!isReady) {
                        } else {
                            const dataExists = await checkIfDataExists(location.pathname);
                            console.log('Data exists:', dataExists);
                            const nextPageFull = nextPage;
                            try {
                                if (dataExists) {
                                    openModal('nav-proceed-btn', async (e: any) => {
                                        try {
                                            abortRequests(location.pathname);
                                        } catch (e) {
                                            console.error('Error in abortRequests:', e);
                                        }
                                        await resetDataAfterPage(location.pathname);
                                        const error = await onNextClick?.(e);
                                        console.log('Abort error on route:', error);
                                        if (!error) {
                                            loadingDispatch({
                                                type: 'SET_FIRST_RUN_DONE',
                                                route: location.pathname
                                            });
                                        } else {
                                            loadingDispatch({
                                                type: 'SET_REST_UNDONE',
                                                route: location.pathname
                                            });
                                        }
                                        autoNavigateToNext && navigate(nextPageFull);
                                    });
                                } else {
                                    try {
                                        abortRequests(location.pathname);
                                    } catch (e) {
                                        console.error('Error in abortRequests:', e);
                                    }
                                    loadingDispatch({
                                        type: 'SET_REST_UNDONE',
                                        route: location.pathname
                                    });
                                    const error = onNextClick && (await onNextClick?.(e));
                                    console.log('Abort error on route:', error);
                                    if (!error) {
                                        loadingDispatch({
                                            type: 'SET_FIRST_RUN_DONE',
                                            route: location.pathname
                                        });
                                    } else {
                                        loadingDispatch({
                                            type: 'SET_REST_UNDONE',
                                            route: location.pathname
                                        });
                                    }
                                    autoNavigateToNext && navigate(nextPageFull);
                                }
                            } catch (e) {
                                console.error('Error in NavigationBottomBar:', e);
                                navigate(location.pathname);
                            }
                        }
                    }}>
                    Proceed →
                </Link>
            )}
        </div>
    );
};

export default NavigationBottomBar;
