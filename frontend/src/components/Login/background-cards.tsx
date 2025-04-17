import useResponsiveColumns from '../../hooks/Login/use-responsive-columns';
import { CardsGridBackground } from '.';

const exampleWordList = ['Deep', 'Thematic', 'Analysis', 'with', 'Iterative', 'LLM', 'Support'];
function BackgroundWithCards() {
    const TOTAL_COLUMNS = useResponsiveColumns();
    return (
        <div className="relative h-screen w-screen">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <CardsGridBackground rows={5} columns={TOTAL_COLUMNS} wordList={exampleWordList} />
            </div>
        </div>
    );
}

export default BackgroundWithCards;
