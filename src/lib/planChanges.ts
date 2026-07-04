export interface PlanChange {
  type: 'key_changed' | 'item_added' | 'item_removed';
  itemTitle: string;
  itemType: 'song' | 'segment';
  oldKey?: string;
  newKey?: string;
}

export function computeKeyChange(
  prevItem: { title: string; type: 'song' | 'segment'; key?: string | null },
  newKey: string
): PlanChange | null {
  if (prevItem.type !== 'song') return null;
  const oldKey = prevItem.key || undefined;
  if (oldKey === newKey) return null;
  return {
    type: 'key_changed',
    itemTitle: prevItem.title,
    itemType: 'song',
    oldKey,
    newKey,
  };
}

export function computeItemAdded(item: {
  title: string;
  type: 'song' | 'segment';
}): PlanChange {
  return {
    type: 'item_added',
    itemTitle: item.title,
    itemType: item.type,
  };
}

export function computeItemRemoved(item: {
  title: string;
  type: 'song' | 'segment';
}): PlanChange {
  return {
    type: 'item_removed',
    itemTitle: item.title,
    itemType: item.type,
  };
}

export function formatChangesSummary(changes: PlanChange[]): string {
  return changes.map(c => {
    switch (c.type) {
      case 'key_changed':
        return `Key ${c.oldKey || '?'} → ${c.newKey || '?'} for "${c.itemTitle}"`;
      case 'item_added':
        return `Added: ${c.itemTitle}`;
      case 'item_removed':
        return `Removed: ${c.itemTitle}`;
    }
  }).join('\n');
}

export function formatChangesForEmail(changes: PlanChange[]): string {
  const lines = changes.map(c => {
    switch (c.type) {
      case 'key_changed':
        return `• Key change: ${c.oldKey || '?'} → ${c.newKey || '?'} for "${c.itemTitle}"`;
      case 'item_added':
        return `• Added: ${c.itemTitle} (${c.itemType === 'song' ? 'Song' : 'Segment'})`;
      case 'item_removed':
        return `• Removed: ${c.itemTitle} (${c.itemType === 'song' ? 'Song' : 'Segment'})`;
    }
  });
  return lines.join('<br>');
}
