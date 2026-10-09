// Pure view-model for the panel. Browser-safe ESM: no Node APIs, no DOM.
// Groups ModuleViews into the fixed panel order; empty groups are omitted.

const GROUP_ORDER = ['on', 'off', 'attention', 'planned'];

const STATUS_TO_GROUP = {
  on: 'on',
  starting: 'on',
  stopping: 'on',
  off: 'off',
  failed: 'attention',
  blocked: 'attention',
  planned: 'planned',
};

export function groupViews(views) {
  if (!Array.isArray(views)) {
    throw new TypeError('groupViews expects an array of ModuleView');
  }

  const buckets = new Map(GROUP_ORDER.map((key) => [key, []]));
  for (const view of views) {
    const key = STATUS_TO_GROUP[view?.status];
    if (key !== undefined) {
      buckets.get(key).push(view);
    }
  }

  return GROUP_ORDER.filter((key) => buckets.get(key).length > 0).map((key) => ({
    key,
    views: buckets.get(key),
  }));
}
