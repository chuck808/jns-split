<script lang="ts">
  /**
   * A set of native radio buttons styled as cards or a segmented control.
   * Works without JavaScript and submits like any radio group.
   */
  import type { Choice } from './types';
  let {
    legend,
    name,
    options,
    value = $bindable(),
    variant = 'segmented',
    hint,
    disabled = false
  }: {
    legend: string;
    name: string;
    options: Choice[];
    value?: string;
    variant?: 'segmented' | 'cards';
    hint?: string;
    disabled?: boolean;
  } = $props();
</script>

<fieldset class={['ui-choices', variant]} {disabled}>
  <legend>{legend}</legend>
  <div class="options">
    {#each options as option (option.value)}
      <label class="option">
        <input type="radio" {name} value={option.value} bind:group={value} />
        <span class="text">
          <span class="label">{option.label}</span>
          {#if option.description}<span class="description">{option.description}</span>{/if}
        </span>
      </label>
    {/each}
  </div>
  {#if hint}<p class="hint">{hint}</p>{/if}
</fieldset>

<style>
  .ui-choices {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
  legend {
    padding: 0;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--muted);
  }
  .options {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .option {
    position: relative;
    display: flex;
    flex: 0 0 auto;
    min-width: 0;
    margin: 0;
    cursor: pointer;
    color: var(--text);
  }
  .option input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    margin: 0;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    border: 1px solid var(--edge-strong);
    background: var(--field);
    border-radius: 10px;
    width: 100%;
  }
  .segmented .text {
    min-height: var(--touch);
    min-width: 3rem;
    padding: 0 1rem;
    justify-content: center;
    align-items: center;
  }
  .segmented .label {
    font-weight: 600;
    font-size: 0.9375rem;
  }
  .cards .options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
  .cards .text {
    padding: 0.9rem 1rem;
    border-width: 2px;
    border-radius: var(--radius);
  }
  .cards .label {
    font: 700 1.25rem/1.1 var(--font-display);
    text-transform: uppercase;
  }
  .description {
    font-size: 0.875rem;
    color: var(--muted);
  }
  .option:has(input:checked) .text {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .option:has(input:checked) .label {
    color: var(--accent-text);
  }
  .option:has(input:focus-visible) .text {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
  .ui-choices:disabled .option {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .hint {
    margin: 0.5rem 0 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }
</style>
