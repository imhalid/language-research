<script lang="ts">
  import { buildRopeSegments } from '../../lib/utils/rope';
  import type { CanvasWorkspaceNode, Connection } from '../../types/canvas.types';

  interface Props {
    nodes: CanvasWorkspaceNode[];
    connections: Connection[];
  }

  let { nodes, connections }: Props = $props();
  let segments = $derived(buildRopeSegments(nodes, connections));
</script>

<svg class="rope-layer" aria-hidden="true">
  {#each segments as segment (segment.id)}
    <path class="rope-glow" d={segment.d}></path>
    <path class="rope-line" d={segment.d}></path>
    <circle class="rope-endpoint" cx={segment.to.x} cy={segment.to.y} r="4"></circle>
  {/each}
</svg>

<style>
  .rope-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  .rope-glow,
  .rope-line {
    fill: none;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }

  .rope-glow {
    stroke: color-mix(in oklch, var(--color-rope) 55%, transparent);
    stroke-width: 14px;
    opacity: 0.16;
  }

  .rope-line {
    stroke: var(--color-rope);
    stroke-width: 2.25px;
    stroke-dasharray: 8 7;
  }

  .rope-endpoint {
    fill: color-mix(in oklch, var(--color-rope) 70%, white);
    opacity: 0.85;
  }
</style>
