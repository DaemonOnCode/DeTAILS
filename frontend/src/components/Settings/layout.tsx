import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    AiSettingsPage,
    DevtoolsSettingsPage,
    GeneralSettingsPage,
    TransmissionSettings,
    TutorialSettingsPage,
    WorkspaceSettingsPage
} from '.';
import { ROUTES } from '../../constants/Shared';
import { useSettings } from '../../context/settings-context';
import { useEffect } from 'react';

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
    const {
        resetSection,
        updateSettings,
        settingsLoading,
        dirtySections,
        fetchSettings,
        disableBack
    } = useSettings();

    // Fetch settings on component mount.
    useEffect(() => {
        fetchSettings();
    }, []);

    const tabs = {
        general: <GeneralSettingsPage />,
        // workspace: <WorkspaceSettingsPage />,
        ai: <AiSettingsPage />,
        // devtools: <DevtoolsSettingsPage />,
        tutorials: <TutorialSettingsPage />,
        transmission: <TransmissionSettings />
    };

    type Tab = keyof typeof tabs;

    // Parse query params to get the current tab.
    const queryParams = new URLSearchParams(location.search);
    const currentTab: Tab = (queryParams.get('tab') as Tab) ?? (Object.keys(tabs)[0] as Tab);

    // Helper to change the tab in the URL.
    const handleTabChange = (newTab: Tab) => {
        queryParams.set('tab', newTab);
        navigate(
            { pathname: location.pathname, search: queryParams.toString() },
            { state: { ...location.state, previousUrl } }
        );
    };

    // Reset the current section to its default values.
    const handleResetChanges = async () => {
        try {
            await resetSection(currentTab);
            console.log(`Reset ${currentTab} settings to default.`);
        } catch (error) {
            console.error(`Error resetting ${currentTab} settings:`, error);
        }
    };

    // Update the current section with new changes.
    const handleUpdateChanges = async () => {
        try {
            console.log(`Updated ${currentTab} settings successfully.`);
            // In a real scenario, you would collect updated values from a form and call updateSettings.
        } catch (error) {
            console.error(`Error updating ${currentTab} settings:`, error);
        }
    };

    // Show a loading screen if settings are still loading.
    if (settingsLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen p-6">
            <div className="flex flex-1 overflow-hidden">
                <aside className="w-1/4 border-r border-gray-300 p-4">
                    <button
                        onClick={onBackClick}
                        disabled={disableBack}
                        className={`mb-4 ${!disableBack ? 'text-blue-500' : 'text-gray-500 cursor-not-allowed'} hover:underline`}>
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
                                    {tab === 'ai' ? 'AI' : tab}
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>

                <main className="flex-1 p-4 overflow-y-auto">
                    <motion.div
                        key={currentTab}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}>
                        {tabs[currentTab] ?? <p>Tab not found</p>}
                    </motion.div>
                </main>
            </div>

            <footer className="border-t border-gray-300 p-4">
                <div className="flex justify-end space-x-4">
                    <button
                        onClick={handleResetChanges}
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
                        Reset To Default
                    </button>
                    {/* Show Update Changes button only if there are unsaved changes */}
                    {dirtySections[currentTab] && (
                        <button
                            onClick={handleUpdateChanges}
                            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                            Update Changes
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
};

export default SettingsLayout;
