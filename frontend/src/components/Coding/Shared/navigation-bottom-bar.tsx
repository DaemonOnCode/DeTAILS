import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavigationBottomBarProps } from '../../../types/Coding/props';
import { Link } from 'react-router-dom';

const NavigationBottomBar: FC<NavigationBottomBarProps> = ({
    isReady,
    previousPage,
    nextPage,
    onNextClick,
    autoNavigateToNext = true,
    onPreviousClick
}) => {
    const navigate = useNavigate();

    // console.log('Previous page:', previousPage, '/coding/' + previousPage || '');
    return (
        <div className="flex justify-between mt-6">
            <Link
                to={'/coding/' + previousPage || ''}
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
                    className={`px-2 lg:px-4 py-2 rounded transition duration-200 ${
                        isReady
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    }`}
                    onClick={async (e) => {
                        if (!isReady) e.preventDefault();
                        else {
                            e.preventDefault();
                            console.log('Next page clicked');
                            onNextClick && (await onNextClick(e));
                            console.log('Navigating to next page');
                            autoNavigateToNext && navigate('/coding/' + nextPage);
                        }
                    }}>
                    Proceed →
                </Link>
            )}
        </div>
    );
};

export default NavigationBottomBar;
