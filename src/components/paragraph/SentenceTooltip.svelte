<script lang="ts">
  interface Props {
    x: number;
    y: number;
    text: string;
    onConfirm: () => void;
    onClose: () => void;
  }

  let { x, y, text, onConfirm, onClose }: Props = $props();
</script>

<div class="tooltip panel" style={`left:${x}px; top:${y}px;`}>
  <span class="mono muted">sentence split</span>
  <p>{text}</p>
  <div class="actions">
    <button type="button" onmousedown={(event) => event.preventDefault()} onclick={onConfirm}>Bu cümleyi ayır</button>
    <button type="button" onmousedown={(event) => event.preventDefault()} onclick={onClose}>Kapat</button>
  </div>
</div>

<style>
  .tooltip {
    position: absolute;
    z-index: 4;
    display: grid;
    gap: 8px;
    width: min(260px, 100%);
    padding: 10px;
    transform: translate(-50%, -100%);
  }

  p {
    margin: 0;
    color: var(--color-text);
  }

  .actions {
    display: flex;
    gap: 6px;
  }
</style>
