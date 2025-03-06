import { FC } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { ROUTES } from '../../constants/Coding/shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useNavigate } from 'react-router-dom';
import { DetailsIcon } from '../../components/Shared/Icons';

interface HomeCard {
    title: string;
    description: string;
    steps: string[];
    route?: string; // If you want to navigate to a specific route for each card
}

const HomePage: FC = () => {
    const navigate = useNavigate();

    const cards: HomeCard[] = [
        {
            title: 'Background Research',
            description:
                'Provide context and background to guide your thematic analysis. Includes LLM Context, Keyword Cloud, and Keyword Table.',
            steps: ['LLM Context', 'Keyword Cloud', 'Keyword Table'],
            route: `${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.LLM_CONTEXT_V2}` // update if needed
        },
        {
            title: 'Load Data',
            description:
                'Load and parse data from various sources. Includes Data Type selection, Data Source setup, and Dataset Creation.',
            steps: ['Data Type', 'Data Source', 'Dataset Creation'],
            route: `${ROUTES.LOAD_DATA}/${ROUTES.DATA_SOURCE}` // update if needed
        },
        {
            title: 'Codebook Creation',
            description:
                'Create a codebook from a sample of your data. Add, update, or delete codes suggested by the LLM or created manually.',
            steps: ['Review LLM Codes', 'Add Custom Codes', 'Refine Codebook'],
            route: `${ROUTES.CODEBOOK_CREATION}` // update if needed
        },
        {
            title: 'Deductive Coding',
            description:
                'Apply your finalized codebook to the remaining data for a thorough, deductive thematic analysis.',
            steps: ['Apply Codes', 'Review Results'],
            route: `${ROUTES.DEDUCTIVE_CODING}` // update if needed
        },
        {
            title: 'Finalizing Codes',
            description:
                'Consolidate sub-codes into higher-level codes, ensuring your codebook is organized and ready for theme generation.',
            steps: ['Review Sub-codes', 'Group & Merge', 'Finalize Code Hierarchy'],
            route: `${ROUTES.FINALIZING_CODES}` // update if needed
        },
        {
            title: 'Thematic Analysis',
            description:
                'Identify and refine themes from the final code set. Generate high-level themes and analyze data summaries.',
            steps: ['Themes', 'Analysis'],
            route: `${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}` // update if needed
        }
    ];

    return (
        <div className="w-full min-h-page flex flex-col justify-between">
            {/* Main content container */}
            <div className="flex-grow flex flex-col">
                <h1 className="flex text-2xl font-bold p-4 text-center justify-center gap-1">
                    Welcome to{' '}
                    <img src={'details-full-logo.png'} alt="DeTAILS Logo" className="h-7" />
                </h1>
                <p className="text-center text-gray-600 mb-4">
                    Deductive Thematic Analysis with Iterative LLM Support
                </p>

                {/* Card grid */}
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

                            {/* Example button linking to next route */}
                            {/* <div className="mt-4">
                                <button
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                    onClick={() => {
                                        // For example, navigate to the card.route
                                        if (card.route) {
                                            // e.g., if using next/router:
                                            // router.push(card.route);
                                            console.log(`Navigate to ${card.route}`);
                                            navigate(`/${SHARED_ROUTES.CODING}/${card.route}`);
                                        }
                                    }}>
                                    Go to {card.title}
                                </button>
                            </div> */}
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom navigation bar as per your example */}
            <NavigationBottomBar
                nextPage={`${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.LLM_CONTEXT_V2}`}
                isReady={true}
            />
        </div>
    );
};

export default HomePage;
