import { FC } from 'react';

const RelatedCodes: FC<{
    codeSet: string[];
    codeColors: Record<string, string>;
    hoveredCodeText: string[] | null;
}> = ({ codeSet, codeColors, hoveredCodeText }) => {
    return (
        <div>
            <h3 className="text-lg font-bold mb-2">Related Codes</h3>
            <ul className="space-y-2">
                {hoveredCodeText
                    ? hoveredCodeText.map((text, index) => (
                          <li
                              key={index}
                              className="p-2 rounded bg-gray-200"
                              style={{
                                  backgroundColor: codeColors[text]
                              }}>
                              {text}
                          </li>
                      ))
                    : codeSet.map((code, index) => (
                          <li
                              key={index}
                              className="p-2 rounded bg-gray-200"
                              style={{
                                  backgroundColor: codeColors[code]
                              }}>
                              {code}
                          </li>
                      ))}
            </ul>
        </div>
    );
};

export default RelatedCodes;
