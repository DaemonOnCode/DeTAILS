import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding_context';

const CodeReview = () => {
    const { unseenPostData } = useCodingContext();
    return (
        <div>
            <div className="max-h-[calc(100vh-8rem)]">
                <UnifiedCodingPage data={unseenPostData} review={false} showThemes />
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.HOME}
                nextPage={ROUTES.KEYWORD_CLOUD}
                isReady={true}
            />
        </div>
    );
};

export default CodeReview;
