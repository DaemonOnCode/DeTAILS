import { FC } from 'react';
import { useNavigate } from 'react-router-dom';

type NavigationBottomBarProps = {
    isReady?: boolean;
    previousPage?: string;
    nextPage?: string;
    onNextClick?: (e: any) => Promise<void>;
    onPreviousClick?: () => void;
};

const NavigationBottomBar: FC<NavigationBottomBarProps> = ({
    isReady,
    previousPage,
    nextPage,
    onNextClick,
    onPreviousClick
}) => {
    const navigate = useNavigate();

    return (
        <div className="flex justify-between mt-6">
            <a
                href={previousPage}
                className={`${
                    !previousPage && 'invisible'
                } px-4 py-2 rounded transition duration-200 bg-blue-500 text-white hover:bg-blue-600`}
                onClick={(e) => {
                    if (!previousPage) e.preventDefault();
                    else onPreviousClick && onPreviousClick();
                }}>
                &lt;- Go back
            </a>
            {nextPage && (
                <a
                    href={nextPage}
                    className={`px-4 py-2 rounded transition duration-200 ${
                        isReady
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    }`}
                    onClick={async (e) => {
                        if (!isReady) e.preventDefault();
                        else {
                            console.log('Next page clicked');
                            onNextClick && (await onNextClick(e));
                            console.log('Navigating to next page');
                            navigate(nextPage.substring(1));
                        }
                    }}>
                    Proceed -&gt;
                </a>
            )}
        </div>
    );
};

export default NavigationBottomBar;
