import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import useChartSize from '../../utils/useChartSize.js';
import { topFriendsByEvents, getRecencyColor } from '../../utils/timeAgg.js';

export default function TopFriendsBar({ events, friends, onSelectFriend }) {
  const top = useMemo(() => topFriendsByEvents(events, friends, 8), [events, friends]);
  const [containerRef, { width }] = useChartSize({ width: 320, height: 220 });
  const svgRef = useRef(null);

  useEffect(() => {
    if (!width) return;
    const rowH = 26;
    const margin = { top: 8, right: 36, bottom: 8, left: 96 };
    const innerW = Math.max(40, width - margin.left - margin.right);
    const height = Math.max(80, top.length * rowH + margin.top + margin.bottom);
    const innerH = top.length * rowH;

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    if (top.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', 60)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.4)')
        .attr('font-family', 'DM Mono, monospace')
        .attr('font-size', '11px')
        .text('no hangouts in this period');
      return;
    }

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const xMax = d3.max(top, (d) => d.count) || 1;
    const x = d3.scaleLinear().domain([0, xMax]).range([0, innerW]);
    const y = d3
      .scaleBand()
      .domain(top.map((_, i) => i))
      .range([0, innerH])
      .padding(0.22);

    const rows = g
      .selectAll('g.row')
      .data(top)
      .enter()
      .append('g')
      .attr('class', 'row')
      .attr('transform', (_, i) => `translate(0,${y(i)})`)
      .style('cursor', 'pointer')
      .on('click', (_, d) => onSelectFriend && onSelectFriend(d.friend));

    // Background track
    rows
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerW)
      .attr('height', y.bandwidth())
      .attr('rx', 4)
      .attr('fill', 'rgba(255,255,255,0.04)');

    // Filled bar
    rows
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', (d) => x(d.count))
      .attr('height', y.bandwidth())
      .attr('rx', 4)
      .attr('fill', (d) => getRecencyColor(d.friend.last_seen))
      .attr('opacity', 0.85);

    // Name (left)
    rows
      .append('text')
      .attr('x', -8)
      .attr('y', y.bandwidth() / 2)
      .attr('dy', '0.32em')
      .attr('text-anchor', 'end')
      .attr('fill', 'rgba(255,255,255,0.85)')
      .attr('font-family', 'DM Mono, monospace')
      .attr('font-size', '10px')
      .text((d) => d.friend.name)
      .each(function (d) {
        // Truncate long names so they don't overflow.
        const node = this;
        const maxLen = 13;
        if (d.friend.name.length > maxLen) {
          node.textContent = d.friend.name.slice(0, maxLen - 1) + '…';
        }
      });

    // Count (right of bar)
    rows
      .append('text')
      .attr('x', (d) => x(d.count) + 6)
      .attr('y', y.bandwidth() / 2)
      .attr('dy', '0.32em')
      .attr('fill', 'rgba(255,255,255,0.6)')
      .attr('font-family', 'DM Mono, monospace')
      .attr('font-size', '10px')
      .text((d) => d.count);
  }, [top, width, onSelectFriend]);

  return (
    <div className="chart-container chart-container-flex" ref={containerRef}>
      <svg ref={svgRef} />
    </div>
  );
}
