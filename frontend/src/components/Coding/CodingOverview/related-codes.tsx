import { FC, useState } from 'react';

const RelatedCodes: FC<{
    codeSet: string[];
    conflictingCodes?: {
        code: string;
        explanation: string;
        quote: string;
    }[]; // Optional conflicting codes
    codeColors: Record<string, string>;
    hoveredCodeText: string[] | null;
}> = ({ codeSet, conflictingCodes = [], codeColors, hoveredCodeText }) => {
    const [comments, setComments] = useState<Record<string, string>>({});

    // Handle comment changes
    const handleCommentChange = (code: string, comment: string) => {
        setComments((prev) => ({
            ...prev,
            [code]: comment
        }));
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
                            style={{ backgroundColor: codeColors[code] || '#ddd' }}>
                            {code}
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
                                className="p-3 rounded bg-gray-200"
                                style={{ backgroundColor: codeColors[conflict.code] || '#ddd' }}>
                                <div className="flex justify-between items-center">
                                    <span>{conflict.code}</span>
                                    <button className="text-gray-500 hover:text-black">⋮</button>
                                </div>
                                <p>{conflict.quote}</p>
                                <p>{conflict.explanation}</p>
                                <div className="mt-2">
                                    <textarea
                                        placeholder="Add a comment..."
                                        className="w-full p-2 border rounded"
                                        value={comments[conflict.code] || ''}
                                        onChange={(e) =>
                                            handleCommentChange(conflict.code, e.target.value)
                                        }></textarea>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default RelatedCodes;
