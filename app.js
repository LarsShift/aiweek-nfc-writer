(() => {
  const TIMEOUT_MS = 30000;
  const $ = (id) => document.getElementById(id);
  const btn = $('start'), btnText = $('btnText'), banner = $('banner'), indicator = $('indicator'), hint = $('hint');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
    });
  }

  function parseTarget() {
    const raw = new URLSearchParams(location.search).get('url');
    if (!raw) return { error: 'No URL provided. Open this page with ?url=https://example.com' };
    try {
      const u = new URL(raw.trim());
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'Only http(s) URLs are supported.' };
      return { url: u.href };
    } catch {
      return { error: 'The provided URL is invalid.' };
    }
  }

  function showBanner(type, msg) {
    banner.hidden = false;
    banner.className = 'banner ' + type;
    banner.textContent = msg;
  }

  function setState(state, label) {
    btn.className = state === 'loading' || state === 'success' ? state : '';
    btn.disabled = state === 'loading' || state === 'disabled';
    btnText.textContent = label;
    indicator.className = 'indicator' + (state === 'loading' ? ' active' : state === 'success' ? ' success' : state === 'error' ? ' error' : '');
  }

  const target = parseTarget();
  $('target').textContent = target.url || '—';

  if (!('NDEFReader' in window)) {
    setState('disabled', 'Unavailable');
    showBanner('error', 'Web NFC not supported. Please use Chrome on Android via HTTPS.');
    return;
  }
  if (target.error) {
    setState('disabled', 'Start Writing');
    showBanner('error', target.error);
    return;
  }

  let controller = null;

  btn.addEventListener('click', async () => {
    banner.hidden = true;
    controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), TIMEOUT_MS);
    setState('loading', 'Waiting for tag…');
    hint.textContent = 'Hold your phone against the NFC tag now.';
    try {
      const ndef = new NDEFReader();
      await ndef.scan({ signal: controller.signal });
      await ndef.write({ records: [{ recordType: 'url', data: target.url }] }, { signal: controller.signal });
      setState('success', 'Written ✓');
      showBanner('success', 'URL written to the NFC tag successfully.');
      hint.textContent = 'Done. You can write another tag.';
      setTimeout(() => { if (btn.classList.contains('success')) setState('idle', 'Write Another Tag'); }, 3000);
    } catch (err) {
      let msg;
      if (err.name === 'AbortError' || err === 'timeout') {
        msg = controller.signal.reason === 'timeout' ? 'Timed out waiting for an NFC tag. Please try again.' : 'Writing was cancelled.';
      } else if (err.name === 'NotAllowedError') {
        msg = 'NFC permission denied. Allow NFC access and try again.';
      } else if (err.name === 'NotSupportedError') {
        msg = 'NFC is not supported or is turned off on this device.';
      } else if (err.name === 'NetworkError') {
        msg = 'Could not write to the tag. Keep it close and try again.';
      } else {
        msg = 'Error: ' + (err.message || err.name || 'unknown');
      }
      setState('error', 'Try Again');
      btn.className = '';
      showBanner('error', msg);
      hint.textContent = 'Hold the top back of your phone against the NFC tag.';
    } finally {
      clearTimeout(timer);
    }
  });
})();
