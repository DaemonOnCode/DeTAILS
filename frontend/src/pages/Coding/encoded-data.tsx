import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding_context';

const EncodedDataPage = () => {
    const { unseenPostResponse, dispatchUnseenPostResponse } = useCodingContext();
    return (
        <div>
            <div className="max-h-[calc(100vh-8rem)]">
                <UnifiedCodingPage
                    data={unseenPostResponse}
                    dispatchFunction={dispatchUnseenPostResponse}
                    showThemes
                />
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.SPLIT_CHECK}
                nextPage={ROUTES.FINAL}
                isReady={true}
            />
        </div>
    );
};

export default EncodedDataPage;
