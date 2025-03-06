import { FC, useState, useMemo } from 'react';
import { useCodingContext } from '../../../context/coding-context';
import { useTranscriptContext } from '../../../context/transcript-context';
import ChatExplanation from './chat-explanation';

interface RelatedCodesProps {
    // review: boolean;
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
    // review,
    postId,
    datasetId,
    codeResponses,
    codeSet,
    codeCounts,
    conflictingCodes = [],
    codeColors,
    dispatchFunction
}) => {
    // Use CodingContext for code-related state.
    const { dispatchSampledPostResponse, conflictingResponses, setConflictingResponses } =
        useCodingContext();

    // Use TranscriptContext for shared transcript state.
    const { chatHistories, hoveredCodeText, setHoveredCode, selectedExplanations } =
        useTranscriptContext();
    // Local state for comment inputs (for conflicting codes).
    const [comments, setComments] = useState<Record<string, string>>({});

    // First check transcript context for any stored chat history;
    // if not found, fallback to chatHistory stored in codeResponses.
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

    // Filter out any codes that appear in the conflicting codes list.
    const agreedCodes = useMemo(
        () =>
            codeSet.filter((code) => conflictingCodes.every((conflict) => conflict.code !== code)),
        [codeSet, conflictingCodes]
    );

    return (
        <div className="space-y-6" id="transcript-metadata">
            <div>
                <h3 className="text-lg font-bold mb-2">Codes</h3>
                <ul className="space-y-2">
                    {(hoveredCodeText || agreedCodes).map((code, index) => (
                        <li
                            key={index}
                            className="p-2 rounded bg-gray-200"
                            onMouseEnter={() => code && setHoveredCode(code)}
                            onMouseLeave={() => setHoveredCode(null)}
                            style={{ backgroundColor: codeColors[code] || '#ddd' }}>
                            {code} <span className="font-bold">({codeCounts[code]})</span>
                        </li>
                    ))}
                </ul>
            </div>
            <div>
                <h3 className="text-lg font-bold mb-2">Explanations</h3>
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
            {conflictingCodes.length > 0 && (
                <div>
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
                                    className="w-full bg-blue-500 p-4 rounded"
                                    onClick={() => onAgreeWithLLM(conflict.code, conflict.quote)}>
                                    Agree with LLM
                                </button>
                                <div className="mt-2">
                                    <textarea
                                        placeholder="New code..."
                                        className="w-full p-2 border rounded"
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
                                        }></textarea>
                                </div>
                                <button
                                    className="w-full bg-blue-500 p-4 rounded"
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
