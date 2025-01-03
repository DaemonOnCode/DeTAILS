import React, { FC, useEffect, useRef } from 'react';
import * as d3 from 'd3';

type ChordDiagramProps = {
    data: number[][];
    names: string[];
    colors: string[];
};

const ChordDiagram: FC<ChordDiagramProps> = ({ data, names, colors }) => {
    const ref = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const width = 640;
        const height = width;
        const outerRadius = Math.min(width, height) * 0.5 - 30;
        const innerRadius = outerRadius - 20;

        const sum = d3.sum(data.flat());
        const tickStep = d3.tickStep(0, sum, 100);
        const tickStepMajor = d3.tickStep(0, sum, 20);
        const formatValue = d3.formatPrefix(',.0', tickStep);

        const chord = d3
            .chord()
            .padAngle(20 / innerRadius)
            .sortSubgroups(d3.descending);

        const arc = d3.arc<d3.ChordGroup>().innerRadius(innerRadius).outerRadius(outerRadius);

        const ribbon = d3.ribbon().radius(innerRadius);

        const svg = d3.select(ref.current);
        svg.selectAll('*').remove(); // Clear previous contents

        svg.attr('viewBox', [-width / 2, -height / 2, width, height]).attr(
            'style',
            'max-width: 100%; height: auto; font: 10px sans-serif;'
        );

        const chords = chord(data);

        // Groups (arcs)
        const group = svg.append('g').selectAll('g').data(chords.groups).join('g');

        group
            .append('path')
            .attr('fill', (d) => colors[d.index])
            .attr('d', arc)
            .append('title')
            .text((d) => `${d.value.toLocaleString('en-US')} ${names[d.index]}`);

        // Group ticks
        const groupTick = group
            .append('g')
            .selectAll('g')
            .data((d) => groupTicks(d, tickStep))
            .join('g')
            .attr(
                'transform',
                (d) => `rotate(${(d.angle * 180) / Math.PI - 90}) translate(${outerRadius},0)`
            );

        groupTick.append('line').attr('stroke', 'currentColor').attr('x2', 6);

        groupTick
            .filter((d) => d.value % tickStepMajor === 0)
            .append('text')
            .attr('x', 8)
            .attr('dy', '.35em')
            .attr('transform', (d) => (d.angle > Math.PI ? 'rotate(180) translate(-16)' : null))
            .attr('text-anchor', (d) => (d.angle > Math.PI ? 'end' : null))
            .text((d) => formatValue(d.value));

        // Ribbons
        svg.append('g')
            .attr('fill-opacity', 0.7)
            .selectAll('path')
            .data(chords)
            .join('path')
            // @ts-ignore
            .attr('d', ribbon)
            .attr('fill', (d) => colors[d.target.index])
            .attr('stroke', 'white')
            .append('title')
            .text(
                (d) =>
                    `${d.source.value.toLocaleString('en-US')} ${names[d.source.index]} → ${names[d.target.index]}${d.source.index !== d.target.index ? `\n${d.target.value.toLocaleString('en-US')} ${names[d.target.index]} → ${names[d.source.index]}` : ''}`
            );
    }, [data, names, colors]);

    const groupTicks = (d: d3.ChordGroup, step: number) => {
        const k = (d.endAngle - d.startAngle) / d.value;
        return d3.range(0, d.value, step).map((value) => ({
            value,
            angle: value * k + d.startAngle
        }));
    };

    return <svg ref={ref} width={800} height={800} />;
};

export default ChordDiagram;
