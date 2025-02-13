import { FC, useState } from 'react';
import { useCodingContext } from '../../../context/coding-context';
import { SetState } from '../../../types/Coding/shared';

const RelatedCodes: FC<{
    codeSet: string[];
    conflictingCodes?: {
        code: string;
        explanation: string;
        quote: string;
    }[]; // Optional conflicting codes
    codeColors: Record<string, string>;
    hoveredCodeText: string[] | null;
    codeCounts: Record<string, number>;
    hoveredCode: string | null;
    setHoveredCode: SetState<string | null>;
}> = ({
    codeSet,
    conflictingCodes = [],
    codeColors,
    hoveredCodeText,
    codeCounts,
    hoveredCode,
    setHoveredCode
}) => {
    const {
        sampledPostResponse,
        dispatchSampledPostResponse,
        conflictingResponses,
        setConflictingResponses
    } = useCodingContext();

    const [comments, setComments] = useState<Record<string, string>>({});

    // Handle comment changes
    const handleCommentChange = (code: string, comment: string) => {
        setComments((prev) => ({
            ...prev,
            [code]: comment
        }));
    };

    const onAgreeWithLLM = (code: string, quote: string) => {
        setConflictingResponses([
            ...conflictingResponses.filter(
                (response) => response.code !== code && response.quote !== quote
            )
        ]);
    };

    const onAddOwnCode = (code: string, comment: string, index: number) => {
        dispatchSampledPostResponse({
            type: 'UPDATE_CODE',
            // postId: conflictingCodes[index].postId,
            prevCode: code,
            newCode: comment,
            quote: conflictingCodes[index].quote
        });
    };

    // Determine agreed codes (those not in the conflicting codes)
    const agreedCodes = codeSet.filter((code) =>
        conflictingCodes.every((conflict) => conflict.code !== code)
    );

    return (
        <div className="space-y-6">
            {/* Related Codes Section */}
            <div>
                <h3 className="text-lg font-bold mb-2">Related Codes</h3>
                <ul className="space-y-2">
                    {(hoveredCodeText || agreedCodes).map((code, index) => (
                        <li
                            key={index}
                            className="p-2 rounded bg-gray-200"
                            onMouseEnter={() => code && setHoveredCode(code)}
                            onMouseLeave={() => setHoveredCode(null)}
                            style={{ backgroundColor: codeColors[code] || '#ddd' }}>
                            {code}{' '}
                            <span className="font-bold">
                                {codeCounts[code] > 0 && `(${codeCounts[code]})`}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Conflicting Codes Section (conditionally rendered) */}
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
                                    {/* <button className="text-gray-500 hover:text-black" onClick={handleDropdownClick}>⋮</button> */}
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
                                            handleCommentChange(conflict.code, e.target.value)
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
