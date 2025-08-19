// Preload to force native undici fetch & bypass ky-universal/node-fetch v2 prototype issues
// Loads before artillery & Credo.

const undici = require('undici');

function applyUndiciGlobals() {
  const g = globalThis;
  g.fetch = undici.fetch;
  g.Headers = undici.Headers;
  g.Request = undici.Request;
  g.Response = undici.Response;
  if (!g.FormData && undici.FormData) g.FormData = undici.FormData;
  if (!g.Blob && undici.Blob) g.Blob = undici.Blob;
  if (!g.File && undici.File) g.File = undici.File;
  if (!g.URL || !g.URLSearchParams) {
    const urlMod = require('url');
    if (!g.URL) g.URL = urlMod.URL;
    if (!g.URLSearchParams) g.URLSearchParams = urlMod.URLSearchParams;
  }
}
applyUndiciGlobals();

// Unified shim for any node-fetch request
function buildFetchShim() {
  const shim = (url, options) => undici.fetch(url, options);
  shim.default = shim;
  shim.Headers = undici.Headers;
  shim.Request = undici.Request;
  shim.Response = undici.Response;
  shim.FetchError = class FetchError extends Error {};
  shim.AbortError = class AbortError extends Error {};
  return shim;
}
const fetchShim = buildFetchShim();

// Monkey patch Module._load to intercept ANY node-fetch variant BEFORE evaluation
const Module = require('module');
const realLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request && request.includes('node-fetch')) {
    return fetchShim;
  }
  return realLoad(request, parent, isMain);
};

// Patch URLSearchParams prototype methods defensively
(() => {
  const U = globalThis.URLSearchParams;
  if (!U) return;
  const ensure = name => {
    const orig = U.prototype[name];
    if (typeof orig !== 'function') return;
    U.prototype[name] = function(...args) {
      if (!(this instanceof U)) {
        try { return orig.apply(new U(String(this)), args); } catch { throw new TypeError('Invalid URLSearchParams receiver'); }
      }
      return orig.apply(this, args);
    };
  };
  ['get','getAll','set','append','delete','has','entries','forEach','keys','values','toString']
    .forEach(ensure);
})();

console.log('[preload-fetch] undici fetch active; node-fetch intercepted (broad match)');
