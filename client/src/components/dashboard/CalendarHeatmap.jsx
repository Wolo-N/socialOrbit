import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import useChartSize from '../../utils/useChartSize.js';
import { eventTime } from '../../utils/timeAgg.js';

const DAY_MS = 86400000;

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function CalendarHeatmap({ events, start, end }) {
  const [containerRef, { width }] = useChartSize({ width: 700, height: 130 });
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!width) return;

    // Aggregate events by day
    const counts = new Map();
    for (const e of events) {
      const d = startOfDay(eventTime(e));
      counts.set(d, (counts.get(d) || 0) + 1);
    }

    // Build the day grid from `start` to `end`, inclusive.
    // Snap start to a Sunday so columns line up to weeks.
    let cursor = new Date(startOfDay(start));
    cursor.setDate(cursor.getDate() - cursor.getDay()); // back to Sunday
    const stop = startOfDay(end);

    const days = [];
    let safety = 53 * 7 * 5;
    while (cursor.getTime() <= stop && safety-- > 0) {
      days.push({
        date: new Date(cursor),
        count: counts.get(cursor.getTime()) || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const weeks = Math.ceil(days.length / 7);
    const cellSize = Math.max(8, Math.min(14, Math.floor((width - 40) / Math.max(weeks, 1)) - 2));
    const cellGap = 2;
    const height = 7 * (cellSize + cellGap) + 30;

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    if (events.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.4)')
        .attr('font-family', 'DM Mono, monospace')
        .attr('font-size', '11px')
        .text('no events to plot');
      return;
    }

    const maxCount = d3.max(days, (d) => d.count) || 1;
    const color = d3
      .scaleSequential()
      .domain([0, maxCount])
      .interpolator(d3.interpolateRgb('rgba(123,110,246,0.08)', '#7b6ef6'));

    const g = svg.append('g').attr('transform', `translate(30,16)`);

    // Day-of-week labels
    ['Mon', 'Wed', 'Fri'].forEach((label, i) => {
      const dow = i * 2 + 1;
      g.append('text')
        .attr('x', -6)
        .attr('y', dow * (cellSize + cellGap) + cellSize - 2)
        .attr('text-anchor', 'end')
        .attr('fill', 'rgba(255,255,255,0.35)')
        .attr('font-family', 'DM Mono, monospace')
        .attr('font-size', '8px')
        .text(label);
    });

    const tooltip = d3.select(tooltipRef.current);

    g.selectAll('rect.day')
      .data(days)
      .enter()
      .append('rect')
      .attr('class', 'day')
      .attr('x', (_, i) => Math.floor(i / 7) * (cellSize + cellGap))
      .attr('y', (_, i) => (i % 7) * (cellSize + cellGap))
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('rx', 2)
      .attr('fill', (d) =>
        d.count === 0 ? 'rgba(255,255,255,0.04)' : color(d.count)
      )
      .attr('stroke', 'rgba(255,255,255,0.04)')
      .attr('stroke-width', 1)
      .on('mouseover', (event, d) => {
        tooltip
          .html(
            `<strong>${d.date.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}</strong><br/>${d.count} event${d.count === 1 ? '' : 's'}`
          )
          .classed('visible', true);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', event.clientX + 12 + 'px')
          .style('top', event.clientY - 10 + 'px');
      })
      .on('mouseout', () => tooltip.classed('visible', false));

    // Month labels — show whenever a new month starts in the first row of a week
    let lastMonth = -1;
    for (let week = 0; week < weeks; week++) {
      const day = days[week * 7];
      if (!day) continue;
      if (day.date.getMonth() !== lastMonth) {
        lastMonth = day.date.getMonth();
        g.append('text')
          .attr('x', week * (cellSize + cellGap))
          .attr('y', -4)
          .attr('fill', 'rgba(255,255,255,0.4)')
          .attr('font-family', 'DM Mono, monospace')
          .attr('font-size', '9px')
          .text(day.date.toLocaleDateString(undefined, { month: 'short' }));
      }
    }
  }, [events, start, end, width]);

  return (
    <div className="chart-container" ref={containerRef}>
      <svg ref={svgRef} />
      <div ref={tooltipRef} className="chart-tooltip" />
    </div>
  );
}
