import React, { useState, useEffect, useMemo } from 'react';
import CustomTutorialOverlay, { TutorialStep } from './custom-tutorial-overlay';
import { useSettings } from '../../context/settings-context';

interface TutorialWrapperProps {
    pageId?: string;
    lastPage?: boolean;
    promptOnFirstPage?: boolean;
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

    const effectiveShowTutorial = useMemo(
        () =>
            settings.tutorials.showGlobal &&
            (!pageId || !settings.tutorials.skipPages.includes(pageId)),
        [settings.tutorials, pageId]
    );

    const [showOverlay, setShowOverlay] = useState(false);
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
        if (pageId) {
            await skipTutorialForPage(pageId);
        }
        await updateSettings('tutorials', { hasRun: true, showGlobal: false });
        setShowPrompt(false);
    };

    const handleShowTutorial = async () => {
        await updateSettings('tutorials', { hasRun: true, skipPages: [] });
        setShowPrompt(false);
        setShowOverlay(true);
    };

    const handleOverlayFinish = async () => {
        if (pageId) {
            console.log('pageid', pageId);
            await skipTutorialForPage(pageId);
        }
        if (lastPage) {
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
