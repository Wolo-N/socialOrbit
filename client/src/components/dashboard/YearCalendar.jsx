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

export default function YearCalendar({ events }) {
  const [containerRef, { width }] = useChartSize({ width: 700, height: 140 });
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!width) return;

    const now = Date.now();
    const todayStart = startOfDay(now);

    // Count events per day
    const counts = new Map();
    for (const e of events) {
      const d = startOfDay(eventTime(e));
      counts.set(d, (counts.get(d) || 0) + 1);
    }

    // Build 53×7 grid ending at today's week
    // Find the Saturday of the current week (end of week row)
    const today = new Date(todayStart);
    const todayDow = today.getDay(); // 0=Sun
    // End at the Saturday of the current week so full week columns render
    const endDate = new Date(todayStart);
    endDate.setDate(endDate.getDate() + (6 - todayDow));
    const endTime = endDate.getTime();

    // 53 full weeks = 371 days back from end
    const startTime = endTime - (53 * 7 - 1) * DAY_MS;

    const days = [];
    let cursor = startTime;
    while (cursor <= endTime) {
      days.push({
        date: new Date(cursor),
        ts: cursor,
        count: counts.get(cursor) || 0,
      });
      cursor += DAY_MS;
    }

    const weeks = Math.ceil(days.length / 7);
    const leftPad = 28;
    const topPad = 16;
    const cellSize = Math.max(7, Math.min(13, Math.floor((width - leftPad - 8) / weeks) - 2));
    const cellGap = 2;
    const height = topPad + 7 * (cellSize + cellGap) + 4;

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    const maxCount = d3.max(days, (d) => d.count) || 1;
    const color = d3
      .scaleSequential()
      .domain([0, maxCount])
      .interpolator(d3.interpolateRgb('rgba(123,110,246,0.10)', '#7b6ef6'));

    const g = svg.append('g').attr('transform', `translate(${leftPad},${topPad})`);

    // Weekday labels
    ['Mon', 'Wed', 'Fri'].forEach((label, i) => {
      const dow = i * 2 + 1;
      g.append('text')
        .attr('x', -6)
        .attr('y', dow * (cellSize + cellGap) + cellSize - 1)
        .attr('text-anchor', 'end')
        .attr('fill', 'rgba(255,255,255,0.3)')
        .attr('font-family', 'DM Mono, monospace')
        .attr('font-size', '8px')
        .text(label);
    });

    const tooltip = d3.select(tooltipRef.current);

    // Day cells
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
      .attr('fill', (d) => (d.count === 0 ? 'rgba(255,255,255,0.04)' : color(d.count)))
      .attr('stroke', (d) =>
        d.ts === todayStart ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.03)'
      )
      .attr('stroke-width', (d) => (d.ts === todayStart ? 1.5 : 0.5))
      .on('mouseover', (event, d) => {
        tooltip
          .html(
            `<strong>${d.date.toLocaleDateString(undefined, {
              weekday: 'short',
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

    // Month labels along the top
    let lastMonth = -1;
    for (let week = 0; week < weeks; week++) {
      const day = days[week * 7];
      if (!day) continue;
      const m = day.date.getMonth();
      if (m !== lastMonth) {
        lastMonth = m;
        g.append('text')
          .attr('x', week * (cellSize + cellGap))
          .attr('y', -4)
          .attr('fill', 'rgba(255,255,255,0.35)')
          .attr('font-family', 'DM Mono, monospace')
          .attr('font-size', '9px')
          .text(day.date.toLocaleDateString(undefined, { month: 'short' }));
      }
    }
  }, [events, width]);

  return (
    <div className="chart-container" ref={containerRef}>
      <svg ref={svgRef} />
      <div ref={tooltipRef} className="chart-tooltip" />
    </div>
  );
}
