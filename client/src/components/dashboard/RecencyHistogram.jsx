import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import useChartSize from '../../utils/useChartSize.js';
import { recencyBuckets } from '../../utils/timeAgg.js';

export default function RecencyHistogram({ friends }) {
  const bins = useMemo(() => recencyBuckets(friends), [friends]);
  const [containerRef, { width }] = useChartSize({ width: 320, height: 200 });
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!width) return;
    const height = 200;
    const margin = { top: 12, right: 12, bottom: 32, left: 28 };
    const innerW = Math.max(40, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    if (!friends.length) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.4)')
        .attr('font-family', 'DM Mono, monospace')
        .attr('font-size', '11px')
        .text('no friends yet');
      return;
    }

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3
      .scaleBand()
      .domain(bins.map((b) => b.label))
      .range([0, innerW])
      .padding(0.15);
    const yMax = d3.max(bins, (b) => b.count) || 1;
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

    // Y ticks
    const ticks = y.ticks(3);
    g.append('g')
      .selectAll('line')
      .data(ticks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', 'rgba(255,255,255,0.06)');

    g.append('g')
      .selectAll('text')
      .data(ticks)
      .enter()
      .append('text')
      .attr('x', -6)
      .attr('y', (d) => y(d))
      .attr('dy', '0.32em')
      .attr('text-anchor', 'end')
      .attr('fill', 'rgba(255,255,255,0.4)')
      .attr('font-family', 'DM Mono, monospace')
      .attr('font-size', '9px')
      .text((d) => d);

    const tooltip = d3.select(tooltipRef.current);

    g.selectAll('rect.bar')
      .data(bins)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (b) => x(b.label))
      .attr('width', x.bandwidth())
      .attr('y', (b) => y(b.count))
      .attr('height', (b) => Math.max(0, innerH - y(b.count)))
      .attr('rx', 3)
      .attr('fill', (b) => b.color)
      .attr('opacity', 0.85)
      .on('mouseover', (event, b) => {
        tooltip
          .html(`<strong>${b.label}</strong><br/>${b.count} friend${b.count === 1 ? '' : 's'}`)
          .classed('visible', true);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', event.clientX + 12 + 'px')
          .style('top', event.clientY - 10 + 'px');
      })
      .on('mouseout', () => tooltip.classed('visible', false));

    // X labels
    g.append('g')
      .attr('transform', `translate(0,${innerH + 6})`)
      .selectAll('text')
      .data(bins)
      .enter()
      .append('text')
      .attr('x', (b) => x(b.label) + x.bandwidth() / 2)
      .attr('y', 12)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.45)')
      .attr('font-family', 'DM Mono, monospace')
      .attr('font-size', '8.5px')
      .text((b) => b.label);
  }, [bins, friends, width]);

  return (
    <div className="chart-container" ref={containerRef}>
      <svg ref={svgRef} />
      <div ref={tooltipRef} className="chart-tooltip" />
    </div>
  );
}
