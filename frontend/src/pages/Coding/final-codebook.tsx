import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding_context';

const FinalThemes = () => {
    const { sampledPostWithThemeData } = useCodingContext();
    return (
        <div>
            <div className="max-h-[calc(100vh-8rem)]">
                <UnifiedCodingPage
                    data={sampledPostWithThemeData}
                    showThemes
                    showCodebook
                    download
                />
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.THEMES}
                nextPage={ROUTES.SPLIT_CHECK}
                isReady={true}
            />
        </div>
    );
};

export default FinalThemes;
