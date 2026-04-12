import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import useChartSize from '../../utils/useChartSize.js';
import { cumulativeFriendCounts } from '../../utils/timeAgg.js';

export default function CumulativeFriends({ friends }) {
  const series = useMemo(() => cumulativeFriendCounts(friends), [friends]);
  const [containerRef, { width }] = useChartSize({ width: 320, height: 200 });
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!width) return;
    const height = 200;
    const margin = { top: 12, right: 14, bottom: 24, left: 28 };
    const innerW = Math.max(40, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    if (series.length < 2) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.4)')
        .attr('font-family', 'DM Mono, monospace')
        .attr('font-size', '11px')
        .text(series.length === 0 ? 'no friends yet' : 'add another friend to see a trend');
      return;
    }

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Anchor the line to "today" so the curve always extends to the right edge.
    const last = series[series.length - 1];
    const extended = [...series, { date: new Date(), count: last.count }];

    const x = d3
      .scaleTime()
      .domain(d3.extent(extended, (d) => d.date))
      .range([0, innerW]);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(extended, (d) => d.count) || 1])
      .nice()
      .range([innerH, 0]);

    // Y grid
    const yTicks = y.ticks(3);
    g.append('g')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', 'rgba(255,255,255,0.06)');
    g.append('g')
      .selectAll('text')
      .data(yTicks)
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

    // Area
    const area = d3
      .area()
      .x((d) => x(d.date))
      .y0(innerH)
      .y1((d) => y(d.count))
      .curve(d3.curveStepAfter);

    g.append('path')
      .datum(extended)
      .attr('d', area)
      .attr('fill', 'rgba(123,110,246,0.18)');

    // Line
    const line = d3
      .line()
      .x((d) => x(d.date))
      .y((d) => y(d.count))
      .curve(d3.curveStepAfter);

    g.append('path')
      .datum(extended)
      .attr('d', line)
      .attr('stroke', '#7b6ef6')
      .attr('stroke-width', 1.8)
      .attr('fill', 'none');

    // X-axis: first / mid / last labels
    const xTicks = x.ticks(Math.min(4, extended.length));
    g.append('g')
      .attr('transform', `translate(0,${innerH + 4})`)
      .selectAll('text')
      .data(xTicks)
      .enter()
      .append('text')
      .attr('x', (d) => x(d))
      .attr('y', 12)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.4)')
      .attr('font-family', 'DM Mono, monospace')
      .attr('font-size', '9px')
      .text((d) =>
        d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
      );

    // End-point dot + label
    const lastPoint = extended[extended.length - 2]; // ignore the synthetic anchor
    g.append('circle')
      .attr('cx', x(lastPoint.date))
      .attr('cy', y(lastPoint.count))
      .attr('r', 3)
      .attr('fill', '#a78bfa');
  }, [series, width]);

  return (
    <div className="chart-container" ref={containerRef}>
      <svg ref={svgRef} />
      <div ref={tooltipRef} className="chart-tooltip" />
    </div>
  );
}
