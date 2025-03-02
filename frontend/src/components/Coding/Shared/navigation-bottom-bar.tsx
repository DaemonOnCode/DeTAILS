import { FC, useState } from 'react';
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

    const { resetDataAfterPage, loadingState } = useLoadingContext();

    const [showProceedConfirmModal, setShowProceedConfirmModal] = useState(false);

    // Handler for confirming the proceed action.
    const handleConfirmProceed = async (e: any) => {
        setShowProceedConfirmModal(false);
        await loadingState[location.pathname]?.stepRef.current?.downloadData?.();
        resetDataAfterPage(location.pathname);
        onNextClick && (await onNextClick(e));
        autoNavigateToNext && navigate('/coding/' + nextPage);
    };

    // Cancel the proceed action.
    const handleCancelProceed = () => {
        setShowProceedConfirmModal(false);
    };

    return (
        <div className="flex justify-between mt-6">
            <Link
                to={'/coding/' + previousPage || ''}
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
                    to={'/coding/' + nextPage}
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
                            // If unsaved data exists, show a confirmation modal on Proceed.
                            // e.preventDefault();
                            const dataExists = loadingState[
                                location.pathname
                            ]?.stepRef.current?.checkDataExistence?.(location.pathname);
                            console.log('Data exists:', dataExists);
                            if (dataExists) {
                                setShowProceedConfirmModal(true);
                            } else {
                                onNextClick && (await onNextClick?.(e));
                                autoNavigateToNext && navigate('/coding/' + nextPage);
                            }
                        }
                    }}>
                    Proceed →
                </Link>
            )}
            {showProceedConfirmModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Confirm Proceed</h2>
                        <p className="mb-4">
                            Proceeding will remove unsaved data. Are you sure you want to continue?
                        </p>
                        <div className="flex justify-end">
                            <button
                                onClick={handleCancelProceed}
                                className="mr-4 bg-gray-300 px-4 py-2 rounded-md hover:bg-gray-400">
                                Cancel
                            </button>
                            <button
                                onClick={(e) => handleConfirmProceed(e)}
                                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">
                                Yes, Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NavigationBottomBar;
