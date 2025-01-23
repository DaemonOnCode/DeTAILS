import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding_context';

const CodeReview = () => {
    const { sampledPostResponse, dispatchSampledPostResponse } = useCodingContext();
    return (
        <div>
            <div className="max-h-[calc(100vh-8rem)]">
                <UnifiedCodingPage
                    data={sampledPostResponse}
                    dispatchFunction={dispatchSampledPostResponse}
                    review={true}
                />
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.KEYWORD_TABLE}
                nextPage={ROUTES.CODEBOOK_REFINEMENT}
                isReady={true}
            />
        </div>
    );
};

export default CodeReview;
