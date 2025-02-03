import { FC } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { ROUTES } from '../../constants/Coding/shared';

const HomePage: FC = () => {
    return (
        <div className="w-full h-full flex flex-col">
            Home page
            <NavigationBottomBar nextPage={ROUTES.CONTEXT_V2} isReady={true} />
        </div>
    );
};

export default HomePage;
