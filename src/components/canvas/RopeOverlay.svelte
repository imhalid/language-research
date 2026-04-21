<script lang="ts">
  import { onMount } from 'svelte';
  import { buildRopeId, resolveCamera, resolveRopeEndpoints } from '../../lib/utils/rope';
  import type { CanvasWorkspaceNode, Connection, ViewState } from '../../types/canvas.types';

  interface Props {
    nodes: CanvasWorkspaceNode[];
    connections: Connection[];
    view: ViewState;
  }

  interface RopeManagerInstance {
    ropes: Map<string, { wake: () => void; from: () => { x: number; y: number }; to: () => { x: number; y: number } }>;
    addRope: (options: {
      id: string;
      from: () => { x: number; y: number };
      to: () => { x: number; y: number };
      lineWidth: number;
      strokeStyle: string;
      slack: number;
      segmentLength: number;
      gravityY: number;
      damping: number;
      solverIterations: number;
    }) => void;
    getRope: (id: string) => { wake: () => void; from: () => { x: number; y: number }; to: () => { x: number; y: number } } | undefined;
    removeRope: (id: string) => void;
    start: () => void;
    destroy: () => void;
  }

  let { nodes, connections, view }: Props = $props();
  let canvas: HTMLCanvasElement | null = null;
  let manager: RopeManagerInstance | null = null;

  const getStrokeStyle = (): string =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-rope').trim() ||
    'rgba(116, 174, 196, 0.65)';

  const resolveConnection = (connection: Connection) =>
    resolveRopeEndpoints(nodes, connection) ?? { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } };

  const syncRopes = (): void => {
    if (!manager) return;

    const nextIds = new Set(connections.map(buildRopeId));

    for (const id of manager.ropes.keys()) {
      if (!nextIds.has(id)) manager.removeRope(id);
    }

    for (const connection of connections) {
      const id = buildRopeId(connection);
      const existing = manager.getRope(id);
      const getPoints = () => resolveConnection(connection);

      if (existing) {
        existing.from = () => getPoints().from;
        existing.to = () => getPoints().to;
        existing.wake();
        continue;
      }

      manager.addRope({
        id,
        from: () => getPoints().from,
        to: () => getPoints().to,
        lineWidth: 2.25,
        strokeStyle: getStrokeStyle(),
        slack: 20,
        segmentLength: 22,
        gravityY: 1080,
        damping: 0.985,
        solverIterations: 6
      });
    }
  };

  onMount(() => {
    let destroyed = false;

    const init = async (): Promise<void> => {
      if (!canvas) return;

      const module = (await import('./rope-manager.js')) as {
        RopeManager: new (options: {
          canvas: HTMLCanvasElement;
          getCamera: () => { x: number; y: number; zoom: number };
          renderMode: 'smooth';
          clearEachFrame: boolean;
          autoResize: boolean;
          minZoomRender: number;
        }) => RopeManagerInstance;
      };

      if (destroyed) return;

      manager = new module.RopeManager({
        canvas,
        getCamera: () => {
          const camera = resolveCamera(view.panX, view.panY, view.zoom);
          return { ...camera, zoom: view.zoom };
        },
        renderMode: 'smooth',
        clearEachFrame: true,
        autoResize: true,
        minZoomRender: 0.3
      });

      syncRopes();
      manager.start();
    };

    void init();

    return () => {
      destroyed = true;
      manager?.destroy();
      manager = null;
    };
  });

  $effect(() => {
    nodes;
    connections;
    syncRopes();
  });
</script>

<canvas bind:this={canvas} class="rope-layer" aria-hidden="true"></canvas>

<style>
  .rope-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }
</style>
