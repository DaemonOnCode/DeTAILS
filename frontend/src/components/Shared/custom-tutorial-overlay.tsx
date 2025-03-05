import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';

export interface TutorialStep {
    target: string;
    content: string;
    placement?: string;
}

interface CustomTutorialOverlayProps {
    steps: TutorialStep[];
    run: boolean;
    onFinish: () => void;
    excludedTarget?: string;
    highlightMargin?: number;
    blurAmount?: number;
    tooltipPadding?: number;
}

function getScrollableAncestors(element: HTMLElement): HTMLElement[] {
    const ancestors: HTMLElement[] = [];
    let currentElement = element.parentElement;
    while (currentElement) {
        const style = getComputedStyle(currentElement);
        if (
            ['auto', 'scroll'].includes(style.overflow) ||
            ['auto', 'scroll'].includes(style.overflowY)
        ) {
            ancestors.push(currentElement);
        }
        currentElement = currentElement.parentElement;
    }
    return ancestors;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}

function shiftInside(raw: number, size: number, containerSize: number): number {
    if (raw < 0) return 0;
    if (raw + size > containerSize) return containerSize - size;
    return raw;
}

const CustomTutorialOverlay: React.FC<CustomTutorialOverlayProps> = ({
    steps,
    run,
    onFinish,
    excludedTarget,
    highlightMargin = 8,
    blurAmount = 5,
    tooltipPadding = 20
}) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [excludedRect, setExcludedRect] = useState<DOMRect | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });
    const prevTargetSelectorRef = useRef<string | null>(null);

    const maskId = `mask-${Math.random().toString(36).slice(2, 11)}`;

    useEffect(() => {
        if (!run || steps.length === 0) return;
        if (currentStepIndex >= steps.length) return onFinish();

        const selector = steps[currentStepIndex].target;

        if (prevTargetSelectorRef.current && prevTargetSelectorRef.current !== selector) {
            const prevElem = document.querySelector(prevTargetSelectorRef.current) as HTMLElement;
            if (prevElem) {
                const ancestors = getScrollableAncestors(prevElem);
                ancestors.forEach((ancestor) => {
                    ancestor.scrollTop = 0;
                });
            }
        }
        prevTargetSelectorRef.current = selector;

        const elem = document.querySelector(selector) as HTMLElement;
        if (!elem) return setTargetRect(null);

        const measureTarget = () => setTargetRect(elem.getBoundingClientRect());
        measureTarget();
        const scrollableAncestors = getScrollableAncestors(elem);
        scrollableAncestors.forEach((ancestor) => {
            ancestor.addEventListener('scroll', measureTarget, { passive: true });
        });
        window.addEventListener('scroll', measureTarget, true);
        window.addEventListener('resize', measureTarget);
        const ro = new ResizeObserver(measureTarget);
        ro.observe(elem);
        return () => {
            scrollableAncestors.forEach((ancestor) => {
                ancestor.removeEventListener('scroll', measureTarget);
            });
            window.removeEventListener('scroll', measureTarget, true);
            window.removeEventListener('resize', measureTarget);
            ro.disconnect();
        };
    }, [run, currentStepIndex, steps, onFinish]);

    useEffect(() => {
        if (!excludedTarget) return;
        const validSelector = excludedTarget.startsWith('#')
            ? '#' + CSS.escape(excludedTarget.slice(1))
            : excludedTarget;
        const elem = document.querySelector(validSelector) as HTMLElement;
        if (!elem) return setExcludedRect(null);

        const measureExcluded = () => setExcludedRect(elem.getBoundingClientRect());
        measureExcluded();
        const scrollableAncestors = getScrollableAncestors(elem);
        scrollableAncestors.forEach((ancestor) => {
            ancestor.addEventListener('scroll', measureExcluded, { passive: true });
        });
        window.addEventListener('scroll', measureExcluded, true);
        window.addEventListener('resize', measureExcluded);
        const ro = new ResizeObserver(measureExcluded);
        ro.observe(elem);
        return () => {
            scrollableAncestors.forEach((ancestor) => {
                ancestor.removeEventListener('scroll', measureExcluded);
            });
            window.removeEventListener('scroll', measureExcluded, true);
            window.removeEventListener('resize', measureExcluded);
            ro.disconnect();
        };
    }, [excludedTarget]);

    useEffect(() => {
        if (!targetRect) return;
        const selector = steps[currentStepIndex].target;
        const elem = document.querySelector(selector) as HTMLElement;
        if (!elem) return;
        if (targetRect.top < 0 || targetRect.bottom > window.innerHeight) {
            elem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [targetRect, currentStepIndex, steps]);

    const svgMask = (
        <svg
            width={window.innerWidth}
            height={window.innerHeight}
            className="absolute top-0 left-0 z-[9999]">
            <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse">
                    <rect width="100%" height="100%" fill="white" />
                    {targetRect && (
                        <rect
                            x={targetRect.left - highlightMargin}
                            y={targetRect.top - highlightMargin}
                            width={targetRect.width + 2 * highlightMargin}
                            height={targetRect.height + 2 * highlightMargin}
                            fill="black"
                            rx="12"
                            ry="12"
                        />
                    )}
                    {excludedRect && (
                        <rect
                            x={excludedRect.left - highlightMargin}
                            y={excludedRect.top - highlightMargin}
                            width={excludedRect.width + 2 * highlightMargin}
                            height={excludedRect.height + 2 * highlightMargin}
                            fill="black"
                            rx="12"
                            ry="12"
                        />
                    )}
                </mask>
            </defs>
        </svg>
    );

    // --- Full-Screen Blurred Background with CSS Mask ---
    const fullScreenBlur = (
        <div
            className="fixed top-0 left-0 w-full h-full z-[9998] pointer-events-none bg-black bg-opacity-70"
            style={{
                backdropFilter: `blur(${blurAmount}px)`,
                WebkitBackdropFilter: `blur(${blurAmount}px)`,
                maskImage: `url(#${maskId})`,
                WebkitMaskImage: `url(#${maskId})`
            }}
        />
    );

    useLayoutEffect(() => {
        if (!tooltipRef.current || !targetRect) return;

        const tooltip = tooltipRef.current;
        const { width: tWidth, height: tHeight } = tooltip.getBoundingClientRect();
        setTooltipSize({ width: tWidth, height: tHeight });

        const placement = steps[currentStepIndex].placement || 'auto';
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let rawX = targetRect.left + targetRect.width / 2 - tWidth / 2;
        let rawY = targetRect.bottom + highlightMargin + tooltipPadding;

        if (placement !== 'auto') {
            const [primary, secondary] = placement.split(' ');
            switch (primary) {
                case 'top':
                    rawY = targetRect.top - tHeight - tooltipPadding;
                    if (secondary === 'left') rawX = targetRect.left;
                    if (secondary === 'right') rawX = targetRect.right - tWidth;
                    break;
                case 'bottom':
                    rawY = targetRect.bottom + tooltipPadding;
                    if (secondary === 'left') rawX = targetRect.left;
                    if (secondary === 'right') rawX = targetRect.right - tWidth;
                    break;
                case 'left':
                    rawX = targetRect.left - tWidth - tooltipPadding;
                    rawY = targetRect.top + targetRect.height / 2 - tHeight / 2;
                    break;
                case 'right':
                    rawX = targetRect.right + tooltipPadding;
                    rawY = targetRect.top + targetRect.height / 2 - tHeight / 2;
                    break;
            }
        } else {
            const spaceBelow = vh - targetRect.bottom - tooltipPadding;
            const spaceAbove = targetRect.top - tooltipPadding;
            if (spaceBelow < tHeight && spaceAbove >= tHeight) {
                rawY = targetRect.top - tHeight - tooltipPadding;
            }
        }

        const finalX = shiftInside(rawX, tWidth, vw);
        const finalY = shiftInside(rawY, tHeight, vh);

        tooltip.style.left = `${finalX}px`;
        tooltip.style.top = `${finalY}px`;
    }, [targetRect, currentStepIndex, steps, highlightMargin, tooltipPadding]);

    const handleFinish = () => {
        const elem = document.querySelector(steps[currentStepIndex].target) as HTMLElement;
        if (elem) {
            const ancestors = getScrollableAncestors(elem);
            ancestors.forEach((ancestor) => (ancestor.scrollTop = 0));
        }
        onFinish();
    };

    if (!run || steps.length === 0 || !targetRect) return null;

    return (
        <>
            {svgMask}
            {fullScreenBlur}
            <div
                ref={tooltipRef}
                className="fixed z-[10000] bg-white p-3 rounded-lg max-w-[300px] text-center shadow-md pointer-events-auto">
                <p className="m-0">{steps[currentStepIndex].content}</p>
                <div className="mt-3 flex justify-between gap-2">
                    <button
                        onClick={handleFinish}
                        className="bg-gray-300 px-3 py-1.5 rounded cursor-pointer border-none">
                        Skip
                    </button>
                    <button
                        onClick={() => setCurrentStepIndex((prev) => (prev > 0 ? prev - 1 : prev))}
                        disabled={currentStepIndex === 0}
                        className={`px-3 py-1.5 rounded border-none ${
                            currentStepIndex > 0
                                ? 'bg-blue-500 text-white cursor-pointer'
                                : 'bg-gray-300 text-white cursor-not-allowed'
                        }`}>
                        Previous
                    </button>
                    <button
                        onClick={() => {
                            if (currentStepIndex < steps.length - 1) {
                                setCurrentStepIndex((prev) => prev + 1);
                            } else {
                                handleFinish();
                            }
                        }}
                        className="bg-blue-500 text-white px-3 py-1.5 rounded cursor-pointer border-none">
                        {currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default CustomTutorialOverlay;
