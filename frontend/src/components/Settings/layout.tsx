import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion'; // Optional: for animations
import {
    DevtoolsSettingsPage,
    GeneralSettingsPage,
    TutorialSettingsPage,
    WorkspaceSettingsPage
} from '.';
import { ROUTES } from '../../constants/Shared';

const SettingsLayout = ({
    authenticated,
    onBackClick,
    previousUrl
}: {
    authenticated: boolean;
    previousUrl: string;
    onBackClick: () => void;
}) => {
    const location = useLocation();
    const navigate = useNavigate();
    const tabs = {
        general: <GeneralSettingsPage />,
        workspace: <WorkspaceSettingsPage />,
        devtools: <DevtoolsSettingsPage />,
        tutorial: <TutorialSettingsPage />
    };

    type Tab = keyof typeof tabs;

    // Parse query params
    const queryParams = new URLSearchParams(location.search);
    const currentTab: Tab = (queryParams.get('tab') as Tab) ?? 'general';

    // Helper to change the tab in the URL
    const handleTabChange = (newTab: Tab) => {
        queryParams.set('tab', newTab);
        navigate(
            { pathname: location.pathname, search: queryParams.toString() },
            { state: { ...location.state, previousUrl } } // Passing state as a separate argument
        );
    };

    return (
        <div className="flex h-screen p-6">
            <aside className="w-1/4 border-r border-gray-300 p-4">
                <button onClick={onBackClick} className="mb-4 text-blue-500 hover:underline">
                    &larr; Back to Application
                </button>
                <ul className="space-y-2">
                    {Object.keys(tabs).map((tab) => (
                        <li key={tab}>
                            <button
                                onClick={() => handleTabChange(tab as Tab)}
                                className={`px-4 py-2 w-full text-left focus:outline-none capitalize ${
                                    currentTab === tab ? 'bg-gray-200' : ''
                                }`}>
                                {tab}
                            </button>
                        </li>
                    ))}
                </ul>
            </aside>

            <main className="flex-1 p-4">
                <motion.div
                    key={currentTab}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}>
                    {tabs[currentTab] ?? <p>Tab not found</p>}
                </motion.div>
            </main>
        </div>
    );
};

export default SettingsLayout;
