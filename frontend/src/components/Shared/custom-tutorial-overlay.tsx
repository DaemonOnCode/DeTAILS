// CustomTutorialOverlay.tsx
import React, { useState, useEffect, useRef } from 'react';

export interface TutorialStep {
    target: string; // CSS selector for the target element (e.g., "#file-section")
    content: string;
    placement?: 'top' | 'bottom' | 'left' | 'right'; // this value is ignored since placement is chosen dynamically
}

interface CustomTutorialOverlayProps {
    steps: TutorialStep[];
    run: boolean;
    onFinish: () => void;
}

const CustomTutorialOverlay: React.FC<CustomTutorialOverlayProps> = ({ steps, run, onFinish }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Dynamically update the target element's bounding rect whenever changes occur.
    useEffect(() => {
        if (!run || steps.length === 0) return;
        const targetElement = document.querySelector(steps[currentStepIndex].target);
        if (!targetElement) {
            setTargetRect(null);
            return;
        }

        const updateRect = () => {
            setTargetRect(targetElement.getBoundingClientRect());
        };

        updateRect(); // initial measure

        // Use ResizeObserver to watch for size changes.
        let observer: ResizeObserver | null = null;
        if (window.ResizeObserver) {
            observer = new ResizeObserver(updateRect);
            observer.observe(targetElement);
        }

        // Also update on scroll and window resize events.
        window.addEventListener('scroll', updateRect, true);
        window.addEventListener('resize', updateRect);

        return () => {
            if (observer) observer.disconnect();
            window.removeEventListener('scroll', updateRect, true);
            window.removeEventListener('resize', updateRect);
        };
    }, [run, currentStepIndex, steps]);

    if (!run || steps.length === 0 || !targetRect) return null;

    const step = steps[currentStepIndex];

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
        } else {
            onFinish();
        }
    };

    const handleSkip = () => {
        onFinish();
    };

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Create four overlay divs covering the page except for the target area.
    const overlays = (
        <>
            {/* Top overlay */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: targetRect.top,
                    backgroundColor: 'rgba(0,0,0,0.7)'
                }}
            />
            {/* Bottom overlay */}
            <div
                style={{
                    position: 'absolute',
                    top: targetRect.bottom,
                    left: 0,
                    width: '100%',
                    height: viewportHeight - targetRect.bottom,
                    backgroundColor: 'rgba(0,0,0,0.7)'
                }}
            />
            {/* Left overlay */}
            <div
                style={{
                    position: 'absolute',
                    top: targetRect.top,
                    left: 0,
                    width: targetRect.left,
                    height: targetRect.height,
                    backgroundColor: 'rgba(0,0,0,0.7)'
                }}
            />
            {/* Right overlay */}
            <div
                style={{
                    position: 'absolute',
                    top: targetRect.top,
                    left: targetRect.right,
                    width: viewportWidth - targetRect.right,
                    height: targetRect.height,
                    backgroundColor: 'rgba(0,0,0,0.7)'
                }}
            />
        </>
    );

    // --- Dynamic Tooltip Positioning ---
    // Assume a fixed tooltip height; adjust as needed.
    const tooltipHeight = 80;
    const margin = 20; // minimal separation between target and tooltip

    const spaceAbove = targetRect.top;
    const spaceBelow = viewportHeight - targetRect.bottom;

    let tooltipStyle: React.CSSProperties = {};

    if (spaceBelow >= tooltipHeight + margin) {
        // Enough room below: place tooltip below target.
        tooltipStyle = {
            top: targetRect.bottom + margin,
            left: targetRect.left + targetRect.width / 2,
            transform: 'translate(-50%, 0)'
        };
    } else if (spaceAbove >= tooltipHeight + margin) {
        // Otherwise, if enough room above: place tooltip above target.
        tooltipStyle = {
            top: targetRect.top - tooltipHeight - margin,
            left: targetRect.left + targetRect.width / 2,
            transform: 'translate(-50%, 0)'
        };
    } else {
        // If neither side has sufficient space, fallback to bottom-center.
        tooltipStyle = {
            bottom: margin,
            left: '50%',
            transform: 'translateX(-50%)'
        };
    }
    // --- End Dynamic Positioning ---

    return (
        <>
            {/* Overlays */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: viewportWidth,
                    height: viewportHeight,
                    zIndex: 10000,
                    pointerEvents: 'none'
                }}>
                {overlays}
            </div>
            {/* Tooltip */}
            <div
                ref={tooltipRef}
                style={{
                    position: 'fixed',
                    ...tooltipStyle,
                    backgroundColor: '#fff',
                    padding: '12px',
                    borderRadius: '4px',
                    zIndex: 10001,
                    maxWidth: '300px',
                    textAlign: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    pointerEvents: 'auto'
                }}>
                <p style={{ margin: 0 }}>{step.content}</p>
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleSkip}
                        style={{
                            backgroundColor: '#ccc',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            marginRight: '8px',
                            cursor: 'pointer'
                        }}>
                        Skip
                    </button>
                    <button
                        onClick={handleNext}
                        style={{
                            backgroundColor: '#007BFF',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}>
                        Next
                    </button>
                </div>
            </div>
        </>
    );
};

export default CustomTutorialOverlay;
