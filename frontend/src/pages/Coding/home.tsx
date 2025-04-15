import { FC } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { PAGE_ROUTES } from '../../constants/Coding/shared';

interface HomeCard {
    title: string;
    description: string;
    steps: string[];
    route?: string;
}

const HomePage: FC = () => {
    const cards: HomeCard[] = [
        {
            title: 'Background Research',
            description:
                'Provide context and background to guide your thematic analysis. Includes Context, Related Concepts, and Concept Outline.',
            steps: ['Context', 'Related Concepts', 'Concept Outline']
        },
        {
            title: 'Loading Data',
            description:
                'Load and parse data from various sources. Includes Data Type selection, Data Source setup, and Dataset Creation.',
            steps: ['Data Type', 'Data Source', 'Dataset Creation']
        },
        {
            title: 'Coding',
            description:
                'Perform coding and create a codebook from your data. Add, update, or delete codes suggested by the LLM or created manually.',
            steps: ['Initial Coding', 'Initial Codebook', 'Final Coding']
        },
        {
            title: 'Reviewing Codes',
            description:
                'Consolidate Codes into higher-level codes, ensuring your codebook is organized and ready for theme generation.',
            steps: []
        },
        {
            title: 'Generating Themes',
            description:
                'Identify and refine themes from the final code set. Generate high-level themes.',
            steps: []
        },
        {
            title: 'Report',
            description:
                'Generate a report of your analysis, including themes, codes, and relevant quotes.',
            steps: []
        }
    ];

    return (
        <div className="w-full min-h-page flex flex-col justify-between">
            <div className="flex-grow flex flex-col">
                <h1 className="flex text-2xl font-bold p-4 text-center justify-center gap-1">
                    Welcome to{' '}
                    <img src={'details-full-logo.png'} alt="DeTAILS Logo" className="h-7" />
                </h1>
                <p className="text-center text-gray-600 mb-4">
                    Deep Thematic Analysis with Iterative LLM Support
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4 flex-grow">
                    {cards.map((card, idx) => (
                        <div
                            key={idx}
                            className="border border-gray-300 rounded-lg p-4 shadow hover:shadow-lg transition-shadow flex flex-col justify-between">
                            <div>
                                <h2 className="text-xl font-semibold mb-2">
                                    Step {idx + 1}: {card.title}
                                </h2>
                                <p className="text-sm mb-3">{card.description}</p>
                                <ul className="list-disc pl-5 text-sm text-gray-700">
                                    {card.steps.map((step, sIdx) => (
                                        <li key={sIdx}>{step}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <NavigationBottomBar nextPage={PAGE_ROUTES.CONTEXT_V2} isReady={true} />
        </div>
    );
};

export default HomePage;
