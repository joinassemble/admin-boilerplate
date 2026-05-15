# Customising the shell

The AppShell is a CSS Grid with eight named slots. Forks override only what they need by passing snippet props.

## Slots

| Slot | Position | Default |
|---|---|---|
| `leftRail` | Full-height column, far left | Empty |
| `topbarLeft` | Top bar, left | Empty |
| `topbarCenter` | Top bar, middle | Empty |
| `topbarRight` | Top bar, right | Theme toggle + user + sign-out |
| `subnav` | Strip below top bar | Empty |
| `sidebar` | Column right of left-rail | Auto-generated resource nav + Settings group |
| `main` | Centre content area | Routed page |
| `aside` | Right column | Empty |

The three-level navigation hierarchy:

- **Left rail** → workspace / org / account switcher (Slack-style)
- **Topbar centre** → entity-within-org switcher (film, project, customer)
- **Sidebar** → navigation within the current entity (resources, settings)

## Fork example — workspace switcher in the left rail

`src/client/app.svelte`:

```svelte
<script lang="ts">
  // ... existing imports
  import WorkspaceSwitcher from './lib/your-stuff/WorkspaceSwitcher.svelte';
  import EntitySwitcher from './lib/your-stuff/EntitySwitcher.svelte';
  import SectionTabs from './lib/your-stuff/SectionTabs.svelte';
</script>

{#if session.status === 'authed'}
  <AppShell>
    {#snippet leftRail()}<WorkspaceSwitcher />{/snippet}
    {#snippet topbarCenter()}<EntitySwitcher />{/snippet}
    {#snippet subnav()}<SectionTabs />{/snippet}

    {#snippet main()}
      <Router routes={authedRoutes} />
    {/snippet}
  </AppShell>
{/if}
```

That's it. Unfilled slots collapse their grid tracks to zero. Defaults stay in place for the slots you don't pass.

## Replacing the sidebar entirely

If the auto-generated sidebar isn't what you want, pass your own:

```svelte
<AppShell>
  {#snippet sidebar()}<MyCustomSidebar />{/snippet}
  {#snippet main()}<Router routes={authedRoutes} />{/snippet}
</AppShell>
```
