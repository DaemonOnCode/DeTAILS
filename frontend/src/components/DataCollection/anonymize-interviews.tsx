import { FC } from 'react';

interface AnonymizeInterviewsProps {
    namesToAnonymize: string[];
    anonymizedNames: { [key: string]: string };
    handleAnonymizeChange: (originalName: string, anonymizedName: string) => void;
}

const AnonymizeInterviews: FC<AnonymizeInterviewsProps> = ({
    namesToAnonymize,
    anonymizedNames,
    handleAnonymizeChange
}) => {
    return (
        <section className="flex flex-col h-full w-full py-6 bg-gray-50">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Anonymize Interview Data</h1>
            <div className="flex-1 overflow-auto">
                {namesToAnonymize.length > 0 ? (
                    namesToAnonymize.map((name) => (
                        <div key={name} className="mb-4">
                            <label className="block text-gray-700 mb-2">{name}</label>
                            <input
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                value={anonymizedNames[name] || ''}
                                onChange={(e) => handleAnonymizeChange(name, e.target.value)}
                                placeholder={`Enter anonymized name for ${name}`}
                            />
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500 text-center mt-10">No names found to anonymize.</p>
                )}
            </div>
        </section>
    );
};

export default AnonymizeInterviews;
