<script lang="ts">
  interface Props {
    label: string;
    value: string;
    rows?: number;
    placeholder?: string;
    onCommit: (value: string) => void;
  }

  let { label, value, rows = 4, placeholder = '', onCommit }: Props = $props();
  let draft = $state('');

  $effect(() => {
    draft = value;
  });
</script>

<label class="field">
  <span class="section-label">{label}</span>
  <textarea bind:value={draft} {rows} {placeholder} onblur={() => onCommit(draft)}></textarea>
</label>

<style>
  .field {
    display: grid;
    gap: 6px;
  }

  textarea {
    min-height: 88px;
    padding: 8px;
    resize: vertical;
  }
</style>
