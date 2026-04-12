import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import useChartSize from '../../utils/useChartSize.js';
import { soloGroupSplit } from '../../utils/timeAgg.js';

export default function SoloVsGroupDonut({ events }) {
  const split = useMemo(() => soloGroupSplit(events), [events]);
  const [containerRef, { width }] = useChartSize({ width: 320, height: 220 });
  const svgRef = useRef(null);

  useEffect(() => {
    if (!width) return;
    const height = 260;
    const legendBandH = 38;
    const donutAreaH = height - legendBandH;
    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    if (split.total === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.4)')
        .attr('font-family', 'DM Mono, monospace')
        .attr('font-size', '11px')
        .text('no events in this period');
      return;
    }

    const cx = width / 2;
    const cy = donutAreaH / 2;
    const radius = Math.min(width / 2, donutAreaH / 2) - 16;
    const inner = radius * 0.62;

    const data = [
      { label: 'solo', value: split.solo, color: '#7b6ef6' },
      { label: 'group', value: split.group, color: '#a78bfa' },
    ];

    const pie = d3.pie().value((d) => d.value).sort(null).padAngle(0.02);
    const arc = d3.arc().innerRadius(inner).outerRadius(radius).cornerRadius(4);

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    g.selectAll('path')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', (d) => d.data.color)
      .attr('opacity', 0.9);

    // Center label — total
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.1em')
      .attr('fill', 'rgba(255,255,255,0.95)')
      .attr('font-family', 'Syne, sans-serif')
      .attr('font-weight', 700)
      .attr('font-size', '24px')
      .text(split.total);
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('fill', 'rgba(255,255,255,0.45)')
      .attr('font-family', 'DM Mono, monospace')
      .attr('font-size', '9px')
      .text('events');

    // Legend in its reserved band at the bottom of the SVG
    const legendY = donutAreaH + 14;
    const legend = svg.append('g').attr('transform', `translate(${cx},${legendY})`);
    const legendItems = [
      { label: 'solo', value: split.solo, color: '#7b6ef6' },
      { label: 'group', value: split.group, color: '#a78bfa' },
    ];
    const itemW = 80;
    legendItems.forEach((item, i) => {
      const xOff = (i - (legendItems.length - 1) / 2) * itemW;
      const lg = legend.append('g').attr('transform', `translate(${xOff},0)`);
      lg.append('rect')
        .attr('x', -32)
        .attr('width', 8)
        .attr('height', 8)
        .attr('rx', 2)
        .attr('fill', item.color);
      lg.append('text')
        .attr('x', -20)
        .attr('y', 8)
        .attr('fill', 'rgba(255,255,255,0.7)')
        .attr('font-family', 'DM Mono, monospace')
        .attr('font-size', '10px')
        .text(`${item.label} ${item.value}`);
    });
  }, [split, width]);

  return (
    <div className="chart-container" ref={containerRef}>
      <svg ref={svgRef} />
    </div>
  );
}
