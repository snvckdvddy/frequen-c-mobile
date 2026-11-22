/**
 * Decisions for the add-track sheet's LIBRARY tab, kept apart from the
 * component so they can be unit-tested.
 */

export type LibrarySourceKind = 'local' | 'service';

export interface LibrarySourceInput {
  /** The Local source is offered at all (host only). */
  localAvailable: boolean;
  /** The host tapped the Local pill and has not picked a service since. */
  localPicked: boolean;
  connectedServiceCount: number;
}

/**
 * Which source the LIBRARY tab shows. A guest only ever sees services. A host
 * sees Local when they chose it, and also by default when no service is
 * connected, since there would be no playlists to browse and Local is what
 * they came for. With a service connected the first one stays the default, as
 * it was before Local existed.
 */
export function resolveLibrarySource({
  localAvailable,
  localPicked,
  connectedServiceCount,
}: LibrarySourceInput): LibrarySourceKind {
  if (!localAvailable) return 'service';
  if (localPicked) return 'local';
  return connectedServiceCount === 0 ? 'local' : 'service';
}

export type RowActionLabel = 'IN QUEUE' | 'ADDED ✓' | 'ADD';

/** The action text on a result row, shared by search results and local files. */
export function getRowActionLabel({ inQueue, patched }: { inQueue: boolean; patched: boolean }): RowActionLabel {
  if (inQueue) return 'IN QUEUE';
  if (patched) return 'ADDED ✓';
  return 'ADD';
}
