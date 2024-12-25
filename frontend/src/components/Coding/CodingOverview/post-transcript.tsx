import React, { FC, useState, useMemo } from 'react';

interface PostTranscriptProps {
    post: { title: string; id: string } | null;
    onBack: () => void;
}

const PostTranscript: FC<PostTranscriptProps> = ({ post, onBack }) => {
    const transcript = `React Hooks allow you to use state and other features. ES6 introduced let and const. TypeScript provides static typing for JavaScript. React enables declarative UI development.`;

    const codes = [
        {
            text: 'useState(), useEffect()',
            phrase: 'React Hooks allow you to use state and other features'
        },
        {
            text: 'let, const',
            phrase: 'to use state and other features. ES6 introduced let and const'
        },
        { text: 'TypeScript types', phrase: 'TypeScript provides static typing for JavaScript' }
    ];

    const [hoveredCodeText, setHoveredCodeText] = useState<string[] | null>(null);

    const generateColor = (key: string): string => {
        const hash = Array.from(key).reduce((acc, char) => char.charCodeAt(0) + acc, 0);
        const r = Math.min(((hash * 19) % 200) + 55, 255);
        const g = Math.min(((hash * 37) % 200) + 55, 255);
        const b = Math.min(((hash * 53) % 200) + 55, 255);
        return `rgba(${r}, ${g}, ${b}, 0.8)`; // Slight transparency
    };

    const codeColors = useMemo(() => {
        return codes.reduce(
            (acc, { text }) => {
                acc[text] = generateColor(text);
                return acc;
            },
            {} as Record<string, string>
        );
    }, [codes]);

    const processedSegments = useMemo(() => {
        const charData: {
            char: string;
            backgroundColours: string[];
            relatedCodeText: string[];
        }[] = Array.from(transcript).map((char) => ({
            char,
            backgroundColours: [],
            relatedCodeText: []
        }));

        codes.forEach(({ phrase, text }) => {
            const start = transcript.indexOf(phrase);
            if (start !== -1) {
                for (let i = start; i < start + phrase.length; i++) {
                    charData[i].backgroundColours.push(codeColors[text]);
                    charData[i].relatedCodeText.push(text);
                }
            }
        });

        // Reduce characters into segments
        return charData.reduce(
            (segments, char) => {
                const lastSegment = segments[segments.length - 1];
                if (
                    lastSegment &&
                    JSON.stringify(lastSegment.backgroundColours) ===
                        JSON.stringify(char.backgroundColours) &&
                    JSON.stringify(lastSegment.relatedCodeText) ===
                        JSON.stringify(char.relatedCodeText)
                ) {
                    lastSegment.text += char.char; // Merge character
                } else {
                    segments.push({
                        text: char.char,
                        backgroundColours: char.backgroundColours,
                        relatedCodeText: char.relatedCodeText
                    });
                }
                return segments;
            },
            [] as {
                text: string;
                backgroundColours: string[];
                relatedCodeText: string[];
            }[]
        );
    }, [transcript, codes, codeColors]);

    console.log(processedSegments);

    return !post ? (
        <></>
    ) : (
        <div className="p-4 flex relative">
            <div className="flex-1 min-w-0">
                <button onClick={onBack} className="mb-4 text-blue-500">
                    &lt;- <span className="underline">Back to Posts</span>
                </button>
                <div className="min-h-[calc(100vh-18rem)] h-[calc(100vh-18rem)] overflow-auto">
                    <h2 className="text-xl font-bold mb-4">{post.title}</h2>
                    <div className="text-gray-700 leading-relaxed">
                        {processedSegments.map((segment, index) => {
                            if (segment.backgroundColours.length === 0) {
                                return <span key={index}>{segment.text}</span>;
                            } else if (segment.backgroundColours.length === 1) {
                                return (
                                    <span
                                        key={index}
                                        style={{
                                            backgroundColor: segment.backgroundColours[0]
                                        }}
                                        onMouseEnter={() =>
                                            setHoveredCodeText(segment.relatedCodeText)
                                        }
                                        onMouseLeave={() => setHoveredCodeText(null)}>
                                        {segment.text}
                                    </span>
                                );
                            } else {
                                return segment.backgroundColours.reduceRight(
                                    (inner, bgColor, layerIndex) => (
                                        <span
                                            key={`${index}-${layerIndex}`}
                                            style={{
                                                backgroundColor: bgColor,
                                                position: 'relative',
                                                zIndex: layerIndex + 1
                                            }}
                                            onMouseEnter={() =>
                                                setHoveredCodeText(segment.relatedCodeText)
                                            }
                                            onMouseLeave={() => setHoveredCodeText(null)}>
                                            {inner}
                                        </span>
                                    ),
                                    <span key={index}>{segment.text}</span>
                                );
                            }
                        })}
                    </div>
                </div>
            </div>

            <div className="w-1/3 pl-4 min-h-[calc(100vh-12rem)] h-[calc(100vh-12rem)] overflow-auto">
                <h3 className="text-lg font-bold mb-2">Related Code Snippets</h3>
                <ul className="space-y-2">
                    {hoveredCodeText && hoveredCodeText.length > 0
                        ? hoveredCodeText.map((text, index) => (
                              <li
                                  key={index}
                                  className="p-2 rounded"
                                  style={{
                                      backgroundColor: codeColors[text]
                                  }}>
                                  {text}
                              </li>
                          ))
                        : codes.map((code, index) => (
                              <li
                                  key={index}
                                  className="p-2 rounded"
                                  style={{
                                      backgroundColor: codeColors[code.text]
                                  }}>
                                  {code.text}
                              </li>
                          ))}
                </ul>
            </div>
        </div>
    );
};

export default PostTranscript;
