<script lang="ts">
  interface Props {
    x: number;
    y: number;
    lemma: string;
    translation: string | null;
  }

  let { x, y, lemma, translation }: Props = $props();
</script>

<div class="popover panel" style={`left:${x}px; top:${y}px;`}>
  <span class="mono muted">{lemma}</span>
  <strong>{translation || 'translation pending'}</strong>
</div>

<style>
  .popover {
    position: absolute;
    z-index: 3;
    display: grid;
    gap: 4px;
    min-width: 140px;
    padding: 8px 10px;
    transform: translate(-50%, calc(-100% - 10px));
    pointer-events: none;
  }

  strong {
    font-size: 0.95rem;
  }
</style>
