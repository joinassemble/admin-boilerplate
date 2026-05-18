<script lang="ts">
  import Button from '$client/lib/ui/Button.svelte';
  import IconButton from '$client/lib/ui/IconButton.svelte';
  import Pill from '$client/lib/ui/Pill.svelte';
  import Input from '$client/lib/ui/Input.svelte';
  import Textarea from '$client/lib/ui/Textarea.svelte';
  import Select from '$client/lib/ui/Select.svelte';
  import Checkbox from '$client/lib/ui/Checkbox.svelte';
  import Field from '$client/lib/ui/Field.svelte';
  import Skeleton from '$client/lib/ui/Skeleton.svelte';
  import EmptyState from '$client/lib/ui/EmptyState.svelte';
  import StatCard from '$client/lib/ui/StatCard.svelte';
  import Toolbar from '$client/lib/ui/Toolbar.svelte';
  import Tabs from '$client/lib/ui/Tabs.svelte';
  import Modal from '$client/lib/ui/Modal.svelte';
  import Dropdown from '$client/lib/ui/Dropdown.svelte';
  import { toast } from '$client/lib/toast.svelte';

  let textValue = $state('Example input');
  let textareaValue = $state('Multi-line text\nwith linebreaks');
  let selectValue = $state('a');
  let checked = $state(true);
  let activeTab = $state('overview');
  let modalOpen = $state(false);
</script>

<div class="space-y-12 max-w-4xl">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Design system</h1>
    <p class="text-sm text-[var(--color-muted)]">Every primitive, in one place.</p>
  </header>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Buttons</h2>
    <div class="flex flex-wrap gap-2">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button size="sm">Small</Button>
      <Button disabled>Disabled</Button>
      <IconButton ariaLabel="Settings">⚙</IconButton>
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Pills</h2>
    <div class="flex flex-wrap gap-2">
      <Pill tone="neutral">neutral</Pill>
      <Pill tone="success">success</Pill>
      <Pill tone="warning">warning</Pill>
      <Pill tone="error">error</Pill>
      <Pill tone="info">info</Pill>
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Form inputs</h2>
    <div class="grid grid-cols-2 gap-4 max-w-xl">
      <Field label="Text input"><Input type="text" bind:value={textValue} /></Field>
      <Field label="Email" required><Input type="email" bind:value={textValue} /></Field>
      <Field label="Select"><Select bind:value={selectValue} options={[{value:'a',label:'Option A'},{value:'b',label:'Option B'}]} /></Field>
      <Field label="Checkbox"><Checkbox bind:checked label="Active" /></Field>
      <div class="col-span-2"><Field label="Textarea"><Textarea bind:value={textareaValue} /></Field></div>
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Stat cards</h2>
    <div class="grid grid-cols-4 gap-3">
      <StatCard label="MRR" value="$12,830" delta="+12% vs last month" tone="positive" />
      <StatCard label="Active users" value="2,481" delta="+38 today" tone="positive" />
      <StatCard label="Failed payments" value="3" delta="-2 vs last week" tone="negative" />
      <StatCard label="Churn rate" value="2.4%" />
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Skeleton</h2>
    <div class="space-y-2 max-w-md">
      <Skeleton width="60%" height="14px" />
      <Skeleton width="80%" height="14px" />
      <Skeleton width="40%" height="14px" />
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Empty state</h2>
    <div class="border border-[var(--color-border)] rounded-md">
      <EmptyState title="No records" description="Click New to add the first one." />
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Toolbar</h2>
    <div class="border border-[var(--color-border)] rounded-md px-4">
      <Toolbar>
        {#snippet left()}<span class="text-sm font-medium">Customers</span>{/snippet}
        {#snippet right()}
          <Button variant="secondary" size="sm">Filter</Button>
          <Button size="sm">New</Button>
        {/snippet}
      </Toolbar>
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Tabs</h2>
    <Tabs
      bind:activeKey={activeTab}
      tabs={[
        { key: 'overview', label: 'Overview', content: contentOverview },
        { key: 'history',  label: 'History',  content: contentHistory },
        { key: 'raw',      label: 'Raw JSON', content: contentRaw },
      ]}
    />
    {#snippet contentOverview()}<p class="text-sm">Overview content goes here.</p>{/snippet}
    {#snippet contentHistory()}<p class="text-sm">History content goes here.</p>{/snippet}
    {#snippet contentRaw()}<pre class="text-xs font-mono bg-[var(--color-surface-2)] p-3 rounded">{`{ "id": "cus_001" }`}</pre>{/snippet}
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Modal + Dropdown</h2>
    <div class="flex gap-2">
      <Button onclick={() => (modalOpen = true)}>Open modal</Button>
      <Dropdown>
        {#snippet trigger({ toggle })}
          <Button variant="secondary" onclick={toggle}>Actions ▾</Button>
        {/snippet}
        {#snippet children({ close })}
          <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]" onclick={() => { toast.info('Edit'); close(); }}>Edit</button>
          <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]" onclick={() => { toast.info('Duplicate'); close(); }}>Duplicate</button>
          <hr class="border-[var(--color-border)] my-1" />
          <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)] text-[var(--color-error-fg)]" onclick={() => { toast.error('Deleted'); close(); }}>Delete</button>
        {/snippet}
      </Dropdown>
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">Toasts</h2>
    <div class="flex gap-2">
      <Button variant="secondary" size="sm" onclick={() => toast.success('Saved')}>Success</Button>
      <Button variant="secondary" size="sm" onclick={() => toast.info('Heads up')}>Info</Button>
      <Button variant="secondary" size="sm" onclick={() => toast.error('Something went wrong')}>Error</Button>
    </div>
  </section>
</div>

<Modal bind:open={modalOpen} title="Confirm action">
  <p class="text-sm">Are you sure you want to do the thing? This action can't be undone.</p>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (modalOpen = false)}>Cancel</Button>
    <Button onclick={() => { toast.success('Done'); modalOpen = false; }}>Confirm</Button>
  {/snippet}
</Modal>
