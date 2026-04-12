import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import useChartSize from '../../utils/useChartSize.js';
import { formatBucketLabel } from '../../utils/timeAgg.js';

export default function ActivityChart({ buckets, granularity }) {
  const [containerRef, { width }] = useChartSize({ width: 600, height: 200 });
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!width) return;
    const height = 200;
    const margin = { top: 12, right: 12, bottom: 28, left: 32 };
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    if (!buckets || buckets.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.4)')
        .attr('font-family', 'DM Mono, monospace')
        .attr('font-size', '11px')
        .text('no data in this period');
      return;
    }

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(buckets.map((_, i) => i))
      .range([0, innerW])
      .padding(0.18);

    const yMax = d3.max(buckets, (b) => b.total) || 1;
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

    // Y grid
    const yTicks = y.ticks(4);
    g.append('g')
      .attr('class', 'grid')
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
      .attr('x', -8)
      .attr('y', (d) => y(d))
      .attr('dy', '0.32em')
      .attr('text-anchor', 'end')
      .attr('fill', 'rgba(255,255,255,0.4)')
      .attr('font-family', 'DM Mono, monospace')
      .attr('font-size', '9px')
      .text((d) => d);

    const tooltip = d3.select(tooltipRef.current);

    // Bars (group on bottom, solo stacked on top)
    const barG = g
      .selectAll('g.bar')
      .data(buckets)
      .enter()
      .append('g')
      .attr('class', 'bar')
      .attr('transform', (_, i) => `translate(${x(i)},0)`)
      .on('mouseover', (event, d) => {
        tooltip
          .html(
            `<strong>${formatBucketLabel(d.bucket, granularity)}</strong><br/>` +
              `Total: ${d.total}<br/>` +
              `Solo: ${d.solo}<br/>` +
              `Group: ${d.group}`
          )
          .classed('visible', true);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', event.clientX + 12 + 'px')
          .style('top', event.clientY - 10 + 'px');
      })
      .on('mouseout', () => tooltip.classed('visible', false));

    // Group portion (bottom)
    barG
      .append('rect')
      .attr('x', 0)
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.group))
      .attr('height', (d) => Math.max(0, innerH - y(d.group)))
      .attr('fill', '#a78bfa')
      .attr('rx', 2);

    // Solo portion (stacked on top)
    barG
      .append('rect')
      .attr('x', 0)
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.total))
      .attr('height', (d) => Math.max(0, y(d.group) - y(d.total)))
      .attr('fill', '#7b6ef6')
      .attr('rx', 2);

    // X-axis labels — thinned out so they don't collide.
    const labelStep = Math.max(1, Math.ceil(buckets.length / 8));
    g.append('g')
      .attr('transform', `translate(0,${innerH + 6})`)
      .selectAll('text')
      .data(buckets.filter((_, i) => i % labelStep === 0))
      .enter()
      .append('text')
      .attr('x', (d) => x(buckets.indexOf(d)) + x.bandwidth() / 2)
      .attr('y', 10)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.4)')
      .attr('font-family', 'DM Mono, monospace')
      .attr('font-size', '9px')
      .text((d) => formatBucketLabel(d.bucket, granularity));

    // Legend
    const legend = svg
      .append('g')
      .attr('transform', `translate(${width - margin.right - 110},${margin.top - 4})`);
    [
      { color: '#7b6ef6', label: 'solo' },
      { color: '#a78bfa', label: 'group' },
    ].forEach((item, i) => {
      const lg = legend.append('g').attr('transform', `translate(${i * 56},0)`);
      lg.append('rect').attr('width', 8).attr('height', 8).attr('fill', item.color).attr('rx', 2);
      lg.append('text')
        .attr('x', 12)
        .attr('y', 8)
        .attr('fill', 'rgba(255,255,255,0.55)')
        .attr('font-family', 'DM Mono, monospace')
        .attr('font-size', '9px')
        .text(item.label);
    });
  }, [buckets, width, granularity]);

  return (
    <div className="chart-container" ref={containerRef}>
      <svg ref={svgRef} />
      <div ref={tooltipRef} className="chart-tooltip" />
    </div>
  );
}
