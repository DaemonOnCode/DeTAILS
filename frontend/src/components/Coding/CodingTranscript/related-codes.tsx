import { FC, useState, useMemo } from 'react';
import { useCodingContext } from '../../../context/coding-context';
import { useTranscriptContext } from '../../../context/transcript-context';
import ChatExplanation from './chat-explanation';
import useScrollRestoration from '../../../hooks/Shared/use-scroll-restoration';

interface RelatedCodesProps {
    postId: string;
    datasetId: string;
    codeSet: string[];
    codeResponses: any[];
    codeColors: Record<string, string>;
    codeCounts: Record<string, number>;
    dispatchFunction: (action: any) => void;
    conflictingCodes?: {
        code: string;
        explanation: string;
        quote: string;
    }[];
}

const RelatedCodes: FC<RelatedCodesProps> = ({
    postId,
    datasetId,
    codeResponses,
    codeSet,
    codeCounts,
    conflictingCodes = [],
    codeColors,
    dispatchFunction
}) => {
    const { chatHistories, hoveredCodeText, setHoveredCode, selectedExplanations } =
        useTranscriptContext();

    const { scrollRef: subcodeRef } = useScrollRestoration('subcodes-section');
    const { scrollRef: explanationRef } = useScrollRestoration('explanations-section');

    function getStoredChatHistory(
        postId: string,
        code: string,
        quote: string,
        explanation: string
    ) {
        const key = `${postId}-${code}-${quote}-${explanation}`;
        if (chatHistories && chatHistories[key]) {
            return chatHistories[key];
        }
        const found = codeResponses.find(
            (resp) =>
                resp.postId === postId &&
                resp.code === code &&
                resp.quote === quote &&
                resp.explanation === explanation
        );
        return found?.chatHistory || [];
    }

    return (
        <div className="flex flex-col h-full gap-4" id="transcript-metadata">
            <h3 className="text-lg font-bold">Codes</h3>
            <div className="flex-1 overflow-y-auto" ref={subcodeRef}>
                <ul className="space-y-2">
                    {(hoveredCodeText || codeSet).map((code, index) => (
                        <li
                            key={index}
                            className="p-2 rounded bg-gray-200 cursor-pointer"
                            onMouseEnter={() => code && setHoveredCode(code)}
                            onMouseLeave={() => setHoveredCode(null)}
                            style={{ backgroundColor: codeColors[code] || '#ddd' }}>
                            {code} <span className="font-bold">({codeCounts[code]})</span>
                        </li>
                    ))}
                </ul>
            </div>

            <h3 className="text-lg font-bold">Explanations</h3>
            <div className="flex-1 overflow-y-auto" ref={explanationRef}>
                {selectedExplanations.map((explanationItem) => {
                    const existingChat = getStoredChatHistory(
                        postId,
                        explanationItem.code,
                        explanationItem.fullText,
                        explanationItem.explanation
                    );
                    return (
                        <ChatExplanation
                            key={`${explanationItem.code}-${explanationItem.fullText}-${explanationItem.explanation}`}
                            initialExplanationWithCode={explanationItem}
                            existingChatHistory={existingChat}
                            postId={postId}
                            datasetId={datasetId}
                            dispatchFunction={dispatchFunction}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default RelatedCodes;
