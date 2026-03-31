import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

function getRecencyColor(lastSeen) {
  if (!lastSeen) return '#f87171'; // red — never seen
  const days = Math.floor((Date.now() - new Date(lastSeen)) / 86400000);
  if (days <= 7) return '#34d399';   // green
  if (days <= 30) return '#fbbf24';  // yellow
  if (days <= 60) return '#f97316';  // orange
  return '#f87171';                  // red
}

function getDistance(score) {
  return 270 - (score / 100) * 195;
}

export default function Graph({ friends, events, onSelectFriend, selectedFriend }) {
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Build co-occurrence map
  const coAppearMap = useRef(new Map());
  useEffect(() => {
    const map = new Map();
    for (const evt of events) {
      if (!evt.friends || evt.friends.length < 2) continue;
      for (let i = 0; i < evt.friends.length; i++) {
        for (let j = i + 1; j < evt.friends.length; j++) {
          const key = [evt.friends[i].id, evt.friends[j].id].sort().join('-');
          map.set(key, (map.get(key) || 0) + 1);
        }
      }
    }
    coAppearMap.current = map;
  }, [events]);

  // Resize observer
  useEffect(() => {
    const container = svgRef.current?.parentElement;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Main D3 effect
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    const cx = width / 2;
    const cy = height / 2;

    svg.selectAll('*').remove();

    // Defs for glow filter
    const defs = svg.append('defs');

    const glowFilter = defs.append('filter').attr('id', 'glow');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    glowFilter
      .append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .enter()
      .append('feMergeNode')
      .attr('in', (d) => d);

    const nodeGlow = defs.append('filter').attr('id', 'nodeGlow');
    nodeGlow.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'blur');
    nodeGlow
      .append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .enter()
      .append('feMergeNode')
      .attr('in', (d) => d);

    // Concentric distance rings (score → distance)
    const ringGroup = svg.append('g').attr('class', 'rings');
    const rings = [
      { score: 75, label: 'Close' },
      { score: 50, label: 'Regular' },
      { score: 25, label: 'Distant' },
      { score: 0, label: 'Fading' },
    ];
    rings.forEach(({ score, label }) => {
      const r = getDistance(score);
      ringGroup
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.12)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '6,6');
      ringGroup
        .append('text')
        .attr('x', cx)
        .attr('y', cy - r - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.35)')
        .attr('font-family', 'DM Mono, monospace')
        .attr('font-size', '10px')
        .text(label);
    });

    // Build nodes and links
    const meNode = {
      id: 'me',
      name: 'Me',
      score: 100,
      fx: cx,
      fy: cy,
      isMe: true,
    };

    const friendNodes = friends.map((f) => ({
      id: f.id,
      name: f.name,
      score: f.score || 0,
      last_seen: f.last_seen,
      total_events: f.total_events || 0,
      solo_count: f.solo_count || 0,
      group_count: f.group_count || 0,
      data: f,
    }));

    const nodes = [meNode, ...friendNodes];

    // Links from me to each friend
    const links = friendNodes.map((f) => ({
      source: 'me',
      target: f.id,
      distance: getDistance(f.score),
    }));

    // Co-appearance links between friends
    const coLinks = [];
    coAppearMap.current.forEach((count, key) => {
      if (count >= 2) {
        const [a, b] = key.split('-').map(Number);
        if (friends.find((f) => f.id === a) && friends.find((f) => f.id === b)) {
          coLinks.push({ source: a, target: b, count, isCo: true });
        }
      }
    });

    const allLinks = [...links, ...coLinks];

    // Simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(allLinks)
          .id((d) => d.id)
          .distance((d) => (d.isCo ? 100 : d.distance))
          .strength((d) => (d.isCo ? 0.05 : 0.3))
      )
      .force('charge', d3.forceManyBody().strength(-80))
      .force('collision', d3.forceCollide().radius((d) => (d.isMe ? 35 : 20)))
      .force('x', d3.forceX(cx).strength(0.03))
      .force('y', d3.forceY(cy).strength(0.03))
      .alphaDecay(0.02);

    simRef.current = simulation;

    // Draw links
    const linkGroup = svg.append('g');
    const linkElements = linkGroup
      .selectAll('line')
      .data(allLinks)
      .enter()
      .append('line')
      .attr('stroke', (d) => (d.isCo ? 'rgba(123, 110, 246, 0.12)' : 'rgba(255,255,255,0.06)'))
      .attr('stroke-width', (d) => (d.isCo ? 1 : 1.5))
      .attr('stroke-dasharray', (d) => (d.isCo ? '3,5' : 'none'));

    // Tooltip (defined early so click handler can reference it)
    const tooltip = d3.select(tooltipRef.current);

    // Draw nodes
    const nodeGroup = svg.append('g');
    const dragBehavior = d3
      .drag()
      .clickDistance(5)
      .on('start', (event, d) => {
        if (d.isMe) return;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        if (d.isMe) return;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (d.isMe) return;
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    const nodeElements = nodeGroup
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('cursor', (d) => (d.isMe ? 'default' : 'pointer'))
      .call(dragBehavior)
      .on('click', (event, d) => {
        if (d.isMe) return;
        event.stopPropagation();
        tooltip.classed('visible', false);
        onSelectFriend(d.data);
      });

    // Me node
    nodeElements
      .filter((d) => d.isMe)
      .append('circle')
      .attr('r', 28)
      .attr('fill', '#7b6ef6')
      .attr('filter', 'url(#glow)')
      .attr('opacity', 0.9);

    nodeElements
      .filter((d) => d.isMe)
      .append('circle')
      .attr('r', 32)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(123, 110, 246, 0.3)')
      .attr('stroke-width', 2);

    nodeElements
      .filter((d) => d.isMe)
      .append('text')
      .text('Me')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', 'white')
      .attr('font-family', 'Syne, sans-serif')
      .attr('font-weight', '600')
      .attr('font-size', '12px');

    // Friend nodes
    const friendGroups = nodeElements.filter((d) => !d.isMe);

    friendGroups
      .append('circle')
      .attr('r', (d) => Math.max(10, Math.min(22, 8 + d.total_events * 2)))
      .attr('fill', (d) => getRecencyColor(d.last_seen))
      .attr('opacity', 0.85)
      .attr('filter', 'url(#nodeGlow)');

    friendGroups
      .append('text')
      .text((d) => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => Math.max(10, Math.min(22, 8 + d.total_events * 2)) + 14)
      .attr('fill', 'rgba(255,255,255,0.6)')
      .attr('font-family', 'DM Mono, monospace')
      .attr('font-size', '10px');

    friendGroups
      .on('mouseover', (event, d) => {
        const lastSeenText = d.last_seen
          ? `${Math.floor((Date.now() - new Date(d.last_seen)) / 86400000)}d ago`
          : 'never';
        tooltip
          .html(
            `<strong>${d.name}</strong><br/>` +
              `Score: ${d.score?.toFixed(1)}<br/>` +
              `Last seen: ${lastSeenText}<br/>` +
              `Hangouts: ${d.total_events} (${d.solo_count} solo, ${d.group_count} group)`
          )
          .style('left', event.clientX + 12 + 'px')
          .style('top', event.clientY - 10 + 'px')
          .classed('visible', true);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', event.clientX + 12 + 'px')
          .style('top', event.clientY - 10 + 'px');
      })
      .on('mouseout', () => {
        tooltip.classed('visible', false);
      });

    // Tick
    simulation.on('tick', () => {
      linkElements
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);

      nodeElements.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [friends, events, dimensions, onSelectFriend]);

  return (
    <div className="graph-container">
      <svg ref={svgRef} />
      <div ref={tooltipRef} className="graph-tooltip" />
    </div>
  );
}
