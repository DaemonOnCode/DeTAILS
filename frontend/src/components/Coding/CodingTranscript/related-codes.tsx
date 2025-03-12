import { FC, useState, useMemo } from 'react';
import { useCodingContext } from '../../../context/coding-context';
import { useTranscriptContext } from '../../../context/transcript-context';
import ChatExplanation from './chat-explanation';

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
    const { dispatchSampledPostResponse, conflictingResponses, setConflictingResponses } =
        useCodingContext();
    const { chatHistories, hoveredCodeText, setHoveredCode, selectedExplanations } =
        useTranscriptContext();
    const [comments, setComments] = useState<Record<string, string>>({});

    function getStoredChatHistory(postId: string, code: string, quote: string) {
        const key = `${postId}-${code}-${quote}`;
        if (chatHistories && chatHistories[key]) {
            return chatHistories[key];
        }
        const found = codeResponses.find(
            (resp) => resp.postId === postId && resp.code === code && resp.quote === quote
        );
        return found?.chatHistory || [];
    }

    const handleCommentChange = (code: string, comment: string) => {
        setComments((prev) => ({ ...prev, [code]: comment }));
    };

    const onAgreeWithLLM = (code: string, quote: string) => {
        setConflictingResponses(
            conflictingResponses.filter(
                (response) => response.code !== code || response.quote !== quote
            )
        );
    };

    const onAddOwnCode = (newCode: string, prevCode: string, index: number) => {
        dispatchSampledPostResponse({
            type: 'UPDATE_CODE',
            prevCode,
            newCode,
            quote: conflictingCodes ? conflictingCodes[index].quote : ''
        });
    };

    // Filter out codes that appear in conflictingCodes.
    const agreedCodes = useMemo(
        () =>
            codeSet.filter((code) => conflictingCodes.every((conflict) => conflict.code !== code)),
        [codeSet, conflictingCodes, codeResponses]
    );

    return (
        // This parent container is set up as a flex column with a fixed height.
        // Adjust the height as needed (e.g., using h-screen or a specific pixel value).
        <div className="flex flex-col h-full gap-4" id="transcript-metadata">
            {/* Sub-codes Section */}
            <h3 className="text-lg font-bold">Sub-codes</h3>
            <div className="flex-1 overflow-y-auto">
                <ul className="space-y-2">
                    {(hoveredCodeText || agreedCodes).map((code, index) => (
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

            {/* Explanations Section */}
            <h3 className="text-lg font-bold">Explanations</h3>
            <div className="flex-1 overflow-y-auto">
                {selectedExplanations.map((explanationItem) => {
                    const existingChat = getStoredChatHistory(
                        postId,
                        explanationItem.code,
                        explanationItem.fullText
                    );
                    return (
                        <ChatExplanation
                            key={`${explanationItem.code}-${explanationItem.fullText}`}
                            initialExplanationWithCode={explanationItem}
                            existingChatHistory={existingChat}
                            postId={postId}
                            datasetId={datasetId}
                            dispatchFunction={dispatchFunction}
                        />
                    );
                })}
            </div>

            {/* Conflicting Codes Section (only rendered if present) */}
            {conflictingCodes.length > 0 && (
                <div className="flex-1 overflow-y-auto">
                    <h3 className="text-lg font-bold mb-2">Conflicting Codes</h3>
                    <ul className="space-y-4">
                        {conflictingCodes.map((conflict, index) => (
                            <li
                                key={index}
                                className="p-3 rounded bg-gray-200 flex flex-col space-y-2"
                                style={{ backgroundColor: codeColors[conflict.code] || '#ddd' }}>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold">{conflict.code}</span>
                                </div>
                                <p>Quote: {conflict.quote}</p>
                                <p>Disagreement Explanation: {conflict.explanation}</p>
                                <button
                                    className="w-full bg-blue-500 p-4 rounded text-white"
                                    onClick={() => onAgreeWithLLM(conflict.code, conflict.quote)}>
                                    Agree with LLM
                                </button>
                                <div className="mt-2">
                                    <textarea
                                        placeholder="New code..."
                                        className="w-full p-2 border rounded resize-y"
                                        value={
                                            comments[
                                                JSON.stringify({
                                                    code: conflict.code,
                                                    quote: conflict.quote
                                                })
                                            ] || ''
                                        }
                                        onChange={(e) =>
                                            handleCommentChange(
                                                JSON.stringify({
                                                    code: conflict.code,
                                                    quote: conflict.quote
                                                }),
                                                e.target.value
                                            )
                                        }
                                    />
                                </div>
                                <button
                                    className="w-full bg-blue-500 p-4 rounded text-white"
                                    onClick={() =>
                                        onAddOwnCode(
                                            comments[
                                                JSON.stringify({
                                                    code: conflict.code,
                                                    quote: conflict.quote
                                                })
                                            ],
                                            conflict.code,
                                            index
                                        )
                                    }>
                                    Add Own Code
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default RelatedCodes;
