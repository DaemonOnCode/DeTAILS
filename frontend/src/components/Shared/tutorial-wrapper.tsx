import React, { useState, useEffect, useMemo } from 'react';
import CustomTutorialOverlay, { TutorialStep } from './custom-tutorial-overlay';
import { useSettings } from '../../context/settings-context';

interface TutorialWrapperProps {
    pageId?: string;
    lastPage?: boolean;
    promptOnFirstPage?: boolean; // if true, show modal prompt on first page
    steps: TutorialStep[];
    onFinish?: () => void;
    excludedTarget?: string;
    children: React.ReactNode;
}

const TutorialWrapper: React.FC<TutorialWrapperProps> = ({
    pageId,
    lastPage = false,
    promptOnFirstPage = false,
    steps,
    onFinish,
    excludedTarget,
    children
}) => {
    const { settings, skipTutorialGlobally, skipTutorialForPage, updateSettings } = useSettings();

    // Determine if the tutorial should be shown based on context settings.
    const effectiveShowTutorial = useMemo(
        () =>
            settings.tutorials.showGlobal &&
            (!pageId || !settings.tutorials.skipPages.includes(pageId)),
        [settings.tutorials, pageId]
    );

    // Local state for controlling whether to show the tutorial overlay.
    const [showOverlay, setShowOverlay] = useState(false);
    // Local state for the prompt; only relevant when promptOnFirstPage is true
    // and the global prompt hasn’t been handled (hasRun is false).
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        console.log(
            'effectiveShowTutorial',
            settings.tutorials.showGlobal,
            effectiveShowTutorial,
            promptOnFirstPage,
            settings.tutorials.hasRun
        );
        if (effectiveShowTutorial) {
            if (promptOnFirstPage && !settings.tutorials.hasRun) {
                setShowPrompt(true);
            } else {
                setShowOverlay(true);
            }
        }
    }, [effectiveShowTutorial, promptOnFirstPage, settings.tutorials.hasRun]);

    const handleSkipPrompt = async () => {
        // If the user skips on the first page, disable tutorials globally and mark this page as done.
        if (pageId) {
            await skipTutorialForPage(pageId);
        }
        await updateSettings('tutorials', { hasRun: true, showGlobal: false });
        setShowPrompt(false);
    };

    const handleShowTutorial = async () => {
        // Reset skipPages so that all pages will show their tutorials,
        // and mark that the global prompt has been handled.
        await updateSettings('tutorials', { hasRun: true, skipPages: [] });
        setShowPrompt(false);
        setShowOverlay(true);
    };

    const handleOverlayFinish = async () => {
        // Mark this page as done.
        if (pageId) {
            console.log('pageid', pageId);
            await skipTutorialForPage(pageId);
        }
        if (lastPage) {
            // On the final page, once the tutorial finishes, disable tutorials globally.
            await skipTutorialGlobally();
        }
        onFinish?.();
        setShowOverlay(false);
    };

    return (
        <>
            {effectiveShowTutorial && showPrompt && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-70">
                    <div className="p-6 bg-white rounded shadow-lg text-center">
                        <p className="mb-4">Would you like to view the tutorial?</p>
                        <div className="flex justify-around">
                            <button
                                onClick={handleShowTutorial}
                                className="px-4 py-2 bg-blue-500 text-white rounded mr-2">
                                Show Tutorial
                            </button>
                            <button
                                onClick={handleSkipPrompt}
                                className="px-4 py-2 bg-gray-500 text-white rounded">
                                Skip Tutorial
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {effectiveShowTutorial && showOverlay && (
                <CustomTutorialOverlay
                    steps={steps}
                    run={showOverlay}
                    excludedTarget={excludedTarget}
                    onFinish={handleOverlayFinish}
                />
            )}

            {children}
        </>
    );
};

export default TutorialWrapper;
