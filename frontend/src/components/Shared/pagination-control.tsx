import { FC } from 'react';
import { TooltipMessages } from '../../constants/Shared';
import { useCollectionContext } from '../../context/collection-context';
import { useLoadingContext } from '../../context/loading-context';
import { useLocation } from 'react-router-dom';

type PaginationControlsProps = {
    currentPage: number;
    totalPages: number;
    onNext: () => void;
    onPrevious: () => void;
    loading: boolean;
    locked: boolean;
    onLock: () => void;
    onUnlock: () => void;
    selectedCount: number;
};

const PaginationControls: FC<PaginationControlsProps> = ({
    currentPage,
    totalPages,
    onNext,
    onPrevious,
    loading,
    selectedCount
}) => {
    const { abortRequests, loadingDispatch, checkIfDataExists, openModal, resetDataAfterPage } =
        useLoadingContext();
    const { isLocked, setIsLocked } = useCollectionContext();
    const location = useLocation();
    return (
        <div className="flex items-center justify-between mt-4">
            {/* Previous button */}
            <button
                onClick={onPrevious}
                title={TooltipMessages.Previous}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded ${
                    currentPage === 1
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}>
                Previous
            </button>

            {/* Middle content */}
            <div className="flex items-center space-x-4">
                <p>{selectedCount} posts selected</p>

                {/* If locked, show "Unlock" button; if unlocked, show "Lock" button */}
                <button
                    onClick={async () => {
                        console.log('loading reddit data', loading);
                        if (loading) return;
                        // setIsLocked((locked) => {
                        //     if (!locked) {
                        //         return true;
                        //     }
                        if (!isLocked) {
                            setIsLocked(true);
                            return;
                        }
                        if (await checkIfDataExists(location.pathname)) {
                            openModal('reddit-lock-btn', async (e: any) => {
                                // setShowProceedConfirmModal(false);
                                abortRequests(location.pathname);
                                // loadingDispatch({
                                //     type: 'SET_FIRST_RUN_DONE',
                                //     route: location.pathname
                                // });
                                setIsLocked(false);
                            });
                        } else {
                            abortRequests(location.pathname);
                            loadingDispatch({
                                type: 'SET_REST_UNDONE',
                                route: location.pathname
                            });
                            // loadingDispatch({
                            //     type: 'SET_FIRST_RUN_DONE',
                            //     route: location.pathname
                            // });
                            setIsLocked(false);
                            // return false;
                        }

                        // });
                    }}
                    className={`px-4 py-2 rounded ${
                        isLocked || selectedCount > 0
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-gray-300 cursor-not-allowed'
                    }`}
                    disabled={loading}>
                    {isLocked ? 'Unlock Dataset' : 'Lock Dataset'}
                </button>
            </div>

            {/* Next button */}
            <button
                onClick={onNext}
                title={TooltipMessages.Next}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded ${
                    currentPage === totalPages
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}>
                Next
            </button>
        </div>
    );
};

export default PaginationControls;
