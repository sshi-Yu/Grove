// Theme shell for Grove UI pages. Loads the host-issued theme stylesheet as a
// <link id="hana-theme"> (so the panel also looks right when opened directly in
// a browser, outside the Hana host), keeps it in sync on theme changes, and
// mirrors `appearance` onto `color-scheme` when the host provides one.
//
// The SDK also injects its own <style data-hana-theme-style> copy when hosted;
// the selectors are disjoint (attribute selector vs #hana-theme) so they can
// coexist without fighting.

export function installThemeShell({ hana, document = window.document } = {}) {
  if (!hana || typeof hana.ready !== 'function' || !hana.theme) {
    throw new TypeError('installThemeShell requires the Hana app SDK (hana)');
  }

  let unsubscribe = null;

  function apply(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;

    if (typeof snapshot.cssUrl === 'string' && snapshot.cssUrl) {
      let link = document.getElementById('hana-theme');
      if (!link) {
        link = document.createElement('link');
        link.id = 'hana-theme';
        link.rel = 'stylesheet';
        const head = document.head ?? document.documentElement;
        head.appendChild(link);
      }
      if (link.getAttribute('href') !== snapshot.cssUrl) {
        link.setAttribute('href', snapshot.cssUrl);
      }
    }

    if (snapshot.appearance === 'light' || snapshot.appearance === 'dark') {
      document.documentElement.style.colorScheme = snapshot.appearance;
    }
  }

  // hana.ready() is synchronous in the current SDK (returns undefined) and
  // throws when the page is not served as an App surface (e.g. opened directly
  // in a browser without the host). Convert that into a rejected promise so a
  // dead host degrades the theme only, never the whole panel module.
  let readyResult;
  try {
    readyResult = hana.ready();
  } catch (error) {
    return Promise.reject(error);
  }
  const readyPromise =
    readyResult && typeof readyResult.then === 'function'
      ? readyResult
      : Promise.resolve();
  return readyPromise.then(() => {
    apply(hana.theme.getSnapshot());
    unsubscribe = hana.theme.subscribe(apply);
  });
}
