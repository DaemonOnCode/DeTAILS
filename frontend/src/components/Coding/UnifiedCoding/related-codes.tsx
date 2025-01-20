import { FC } from 'react';

const RelatedCodes: FC<{ codeSet: string[]; hoveredCodeText: string[] | null }> = ({
    codeSet,
    hoveredCodeText
}) => {
    return (
        <div className="mt-6">
            <h3 className="text-lg font-bold mb-2">Related Codes</h3>
            <ul className="space-y-2">
                {hoveredCodeText
                    ? hoveredCodeText.map((text) => (
                          <li key={text} className="p-2 rounded bg-gray-200">
                              {text}
                          </li>
                      ))
                    : codeSet.map((code) => (
                          <li key={code} className="p-2 rounded bg-gray-200">
                              {code}
                          </li>
                      ))}
            </ul>
        </div>
    );
};

export default RelatedCodes;
