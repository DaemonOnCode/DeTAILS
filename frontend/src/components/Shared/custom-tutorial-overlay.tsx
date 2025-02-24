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

    const maskId = `mask-${Math.random().toString(36).slice(2, 11)}`;

    useEffect(() => {
        if (!run || steps.length === 0) return;
        if (currentStepIndex >= steps.length) return onFinish();

        const selector = steps[currentStepIndex].target;
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
    }, [run, currentStepIndex, steps]);

    useEffect(() => {
        if (!excludedTarget) return;
        const elem = document.querySelector(excludedTarget) as HTMLElement;
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
        }

        const finalX = shiftInside(rawX, tWidth, vw);
        const finalY = shiftInside(rawY, tHeight, vh);

        tooltip.style.left = `${finalX}px`;
        tooltip.style.top = `${finalY}px`;
    }, [targetRect, currentStepIndex, steps, highlightMargin, tooltipPadding]);

    if (!run || steps.length === 0 || !targetRect) return null;

    return (
        <>
            <svg
                width={window.innerWidth}
                height={window.innerHeight}
                style={{ position: 'absolute', top: 0, left: 0, zIndex: 9999 }}>
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
                    </mask>
                </defs>
            </svg>

            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    backdropFilter: `blur(${blurAmount}px)`,
                    WebkitBackdropFilter: `blur(${blurAmount}px)`,
                    maskImage: `url(#${maskId})`,
                    WebkitMaskImage: `url(#${maskId})`,
                    zIndex: 9998,
                    pointerEvents: 'none'
                }}
            />

            <div
                ref={tooltipRef}
                style={{
                    position: 'fixed',
                    zIndex: 10000,
                    backgroundColor: '#fff',
                    padding: '12px',
                    borderRadius: '8px',
                    maxWidth: '300px',
                    textAlign: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    pointerEvents: 'auto'
                }}>
                <p style={{ margin: 0 }}>{steps[currentStepIndex].content}</p>
                <div
                    style={{
                        marginTop: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8
                    }}>
                    <button
                        onClick={onFinish}
                        style={{
                            backgroundColor: '#ccc',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            border: 'none',
                            borderRadius: 4
                        }}>
                        Skip
                    </button>
                    <button
                        onClick={() => setCurrentStepIndex((prev) => (prev > 0 ? prev - 1 : prev))}
                        disabled={currentStepIndex === 0}
                        style={{
                            backgroundColor: currentStepIndex > 0 ? '#007BFF' : '#ccc',
                            color: 'white',
                            padding: '6px 12px',
                            cursor: currentStepIndex > 0 ? 'pointer' : 'not-allowed',
                            border: 'none',
                            borderRadius: 4
                        }}>
                        Previous
                    </button>
                    <button
                        onClick={() => {
                            if (currentStepIndex < steps.length - 1) {
                                setCurrentStepIndex((prev) => prev + 1);
                            } else {
                                onFinish();
                            }
                        }}
                        style={{
                            backgroundColor: '#007BFF',
                            color: 'white',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            border: 'none',
                            borderRadius: 4
                        }}>
                        {currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default CustomTutorialOverlay;
