// src/context/TranscriptContext.tsx
import React, { createContext, FC, useContext, useState, useRef, useMemo, ReactNode } from 'react';
import type { ChatMessage, ILayout } from '../types/Coding/shared';

interface ITranscriptContext {
    // State values and their setters
    selectedText: string | null;
    setSelectedText: (text: string | null) => void;
    hoveredCode: string | null;
    setHoveredCode: (code: string | null) => void;
    hoveredCodeText: string[] | null;
    setHoveredCodeText: (codes: string[] | null) => void;
    additionalCodes: string[];
    setAdditionalCodes: (codes: string[]) => void;
    chatHistories: Record<string, ChatMessage[]>;
    setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
    // Helper functions for selection
    handleTextSelection: () => void;
    restoreSelection: () => void;
    removeSelection: () => void;
    // Refs for DOM access
    selectionRangeRef: React.MutableRefObject<Range | null>;
    containerRef: React.RefObject<HTMLDivElement>;
}

const TranscriptContext = createContext<ITranscriptContext>({
    selectedText: null,
    setSelectedText: () => {},
    hoveredCode: null,
    setHoveredCode: () => {},
    hoveredCodeText: null,
    setHoveredCodeText: () => {},
    additionalCodes: [],
    setAdditionalCodes: () => {},
    chatHistories: {},
    setChatHistories: () => {},
    handleTextSelection: () => {},
    restoreSelection: () => {},
    removeSelection: () => {},
    selectionRangeRef: { current: null },
    containerRef: { current: null }
});

export const TranscriptContextProvider: FC<ILayout> = ({ children }) => {
    // Individual state hooks
    const [selectedText, setSelectedText] = useState<string | null>(null);
    const [hoveredCode, setHoveredCode] = useState<string | null>(null);
    const [hoveredCodeText, setHoveredCodeText] = useState<string[] | null>(null);
    const [additionalCodes, setAdditionalCodes] = useState<string[]>([]);
    const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});

    // Refs for selection handling
    const selectionRangeRef = useRef<Range | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle text selection (update selectedText and store the range)
    const handleTextSelection = (): void => {
        console.log('Handling text selection from TranscriptContext');
        const selection: Selection | null = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            console.log('No selection found or empty range.');
            return;
        }
        const range = selection.getRangeAt(0);
        selectionRangeRef.current = range;
        const text = selection.toString().trim();
        console.log('Selected text:', text);
        setSelectedText(text);
    };

    // Restore the previously saved selection
    const restoreSelection = (): void => {
        console.log('Restoring selection from TranscriptContext');
        if (!selectionRangeRef.current) return;
        const selection = window.getSelection();
        if (!selection) return;
        selection.removeAllRanges();
        selection.addRange(selectionRangeRef.current);
    };

    // Remove any active selection and clear the saved range
    const removeSelection = (): void => {
        console.log('Removing selection from TranscriptContext');
        const selection = window.getSelection();
        if (!selection) return;
        selection.removeAllRanges();
        selectionRangeRef.current = null;
    };

    const value = useMemo(
        () => ({
            selectedText,
            setSelectedText,
            hoveredCode,
            setHoveredCode,
            hoveredCodeText,
            setHoveredCodeText,
            additionalCodes,
            setAdditionalCodes,
            chatHistories,
            setChatHistories,
            handleTextSelection,
            restoreSelection,
            removeSelection,
            selectionRangeRef,
            containerRef
        }),
        [selectedText, hoveredCode, hoveredCodeText, additionalCodes, chatHistories]
    );

    return <TranscriptContext.Provider value={value}>{children}</TranscriptContext.Provider>;
};

export const useTranscriptContext = () => useContext(TranscriptContext);
