'use client';

// Adapted from shadcn/ui's base-nova Button, Tabs, and Collapsible components.
// Utility classes are replaced by scoped CSS; only the variants used here remain.
// See THIRD_PARTY_NOTICES.md for source links and the MIT license.
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

export const Button = (props: ButtonPrimitive.Props) => (
  <ButtonPrimitive data-slot="button" className="kk-devtools-button" {...props} />
);

export const Collapsible = (props: CollapsiblePrimitive.Root.Props) => (
  <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
);

export const CollapsibleTrigger = (props: CollapsiblePrimitive.Trigger.Props) => (
  <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
);

export const CollapsibleContent = (props: CollapsiblePrimitive.Panel.Props) => (
  <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
);

export const Tabs = (props: TabsPrimitive.Root.Props) => (
  <TabsPrimitive.Root data-slot="tabs" className="kk-devtools-tabs" {...props} />
);

export const TabsList = (props: TabsPrimitive.List.Props) => (
  <TabsPrimitive.List data-slot="tabs-list" className="kk-devtools-tabs-list" {...props} />
);

export const TabsTrigger = (props: TabsPrimitive.Tab.Props) => (
  <TabsPrimitive.Tab data-slot="tabs-trigger" className="kk-devtools-tab" {...props} />
);

export const TabsContent = (props: TabsPrimitive.Panel.Props) => (
  <TabsPrimitive.Panel data-slot="tabs-content" className="kk-devtools-panel" {...props} />
);
