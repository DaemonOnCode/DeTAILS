import { useState, useEffect } from 'react';
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
import UnsavedChangesModal from './components/unsaved-changes-modal';

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
        settingsLoading,
        dirtySections,
        fetchSettings,
        disableBack,
        clearDirtySections
    } = useSettings();

    // State for modal and navigation
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);
    const [nextAction, setNextAction] = useState<() => void>(() => () => {});
    const [saveCurrentSettings, setSaveCurrentSettings] = useState<() => void>(() => () => {});

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const tabs = {
        general: <GeneralSettingsPage setSaveCurrentSettings={setSaveCurrentSettings} />,
        ai: <AiSettingsPage setSaveCurrentSettings={setSaveCurrentSettings} />,
        tutorials: <TutorialSettingsPage setSaveCurrentSettings={setSaveCurrentSettings} />,
        transmission: <TransmissionSettings setSaveCurrentSettings={setSaveCurrentSettings} />
    };

    type Tab = keyof typeof tabs;

    const queryParams = new URLSearchParams(location.search);
    const currentTab: Tab = (queryParams.get('tab') as Tab) ?? (Object.keys(tabs)[0] as Tab);

    const handleTabChange = (newTab: Tab) => {
        if (disableBack) return;
        if (dirtySections[currentTab]) {
            setNextAction(() => () => {
                queryParams.set('tab', newTab);
                navigate(
                    { pathname: location.pathname, search: queryParams.toString() },
                    { state: { ...location.state, previousUrl } }
                );
            });
            setShowUnsavedModal(true);
        } else {
            queryParams.set('tab', newTab);
            navigate(
                { pathname: location.pathname, search: queryParams.toString() },
                { state: { ...location.state, previousUrl } }
            );
        }
    };

    const handleBackClick = () => {
        if (disableBack) return;
        if (dirtySections[currentTab]) {
            setNextAction(() => onBackClick);
            setShowUnsavedModal(true);
        } else {
            onBackClick();
        }
    };

    const handleResetChanges = async () => {
        try {
            await resetSection(currentTab);
            console.log(`Reset ${currentTab} settings to default.`);
        } catch (error) {
            console.error(`Error resetting ${currentTab} settings:`, error);
        }
    };

    const handleUpdateChanges = () => {
        saveCurrentSettings();
    };

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
                        onClick={handleBackClick}
                        disabled={disableBack}
                        className={`mb-4 ${!disableBack ? 'text-blue-500' : 'text-gray-500 cursor-not-allowed'} hover:underline`}>
                        ← Back to Application
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
                    {dirtySections[currentTab] && (
                        <button
                            onClick={handleUpdateChanges}
                            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                            Update Changes
                        </button>
                    )}
                </div>
            </footer>

            {showUnsavedModal && (
                <UnsavedChangesModal
                    onSave={() => {
                        saveCurrentSettings();
                        setShowUnsavedModal(false);
                        nextAction();
                    }}
                    onDiscard={() => {
                        setShowUnsavedModal(false);
                        nextAction();
                        clearDirtySections();
                    }}
                    onCancel={() => setShowUnsavedModal(false)}
                />
            )}
        </div>
    );
};

export default SettingsLayout;
