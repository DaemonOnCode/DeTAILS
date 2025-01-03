import React from 'react';
import ChordDiagram from './chord-plot';

const DiagramPanel = () => {
    const data = [
        [11975, 5871, 8916, 2868],
        [1951, 10048, 2060, 6171],
        [8010, 16145, 8090, 8045],
        [1013, 990, 940, 6907]
    ];

    const names = ['black', 'blond', 'brown', 'red'];
    const colors = ['#000000', '#ffdd89', '#957244', '#f26223'];

    return (
        <div>
            <ChordDiagram data={data} names={names} colors={colors} />
        </div>
    );
};

export default DiagramPanel;
