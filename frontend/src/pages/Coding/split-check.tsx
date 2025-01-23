import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding_context';

const SplitCheckPage = () => {
    const { unseenPostResponse, dispatchUnseenPostResponse } = useCodingContext();
    return (
        <div>
            <div className="max-h-[calc(100vh-8rem)]">
                <UnifiedCodingPage
                    data={unseenPostResponse}
                    dispatchFunction={dispatchUnseenPostResponse}
                    showThemes
                    split
                    showCodebook
                    review={false}
                    showFilterDropdown
                />
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.FINAL_CODEBOOK}
                nextPage={ROUTES.ENCODED_DATA}
                isReady={true}
            />
        </div>
    );
};

export default SplitCheckPage;
