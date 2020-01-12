/*
Copyright 2019 Manuel Reimer <manuel.reimer@gmx.de>
Copyright 2012 Mozilla Foundation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
/* import-globals-from preserve-referer.js */

'use strict';

var VIEWER_URL = chrome.extension.getURL('content/web/viewer.html');

// Translates the PDF URL to our "viewer URL"
function getViewerURL(pdf_url) {
  // Prepare two URL objects to work with
  const pdfurl = new URL(pdf_url);
  const viewerurl = new URL(VIEWER_URL);

  // Some parameters for PDF.js are passed as a hash which has the same format
  // as URL parameters. So prepare two URLSearchParams objects to work with
  const pdfhash = new URLSearchParams(pdfurl.hash.substr(1));
  const viewerhash = new URLSearchParams();

  // Remove the hash from the PDF URL and use it as the "file" parameter
  pdfurl.hash = "";
  viewerurl.searchParams.append("file", pdfurl.toString());

  // If available, copy over the "page" variable from the PDF URL hash and add
  // our own "pagemode" setting to get rid of the sidebar.
  if (pdfhash.has("page"))
    viewerhash.append("page", pdfhash.get("page"));
  viewerhash.append("pagemode", "none");

  // Get the hash into our viewer URL and return the resulting URL as string
  viewerurl.hash = viewerhash.toString();
  return viewerurl.toString();
}

/**
 * @param {Object} details First argument of the webRequest.onHeadersReceived
 *                         event. The property "url" is read.
 * @return {boolean} True if the PDF file should be downloaded.
 */
function isPdfDownloadable(details) {
  if (details.url.includes('pdfjs.action=download')) {
    return true;
  }
  // Display the PDF viewer regardless of the Content-Disposition header if the
  // file is displayed in the main frame, since most often users want to view
  // a PDF, and servers are often misconfigured.
  // If the query string contains "=download", do not unconditionally force the
  // viewer to open the PDF, but first check whether the Content-Disposition
  // header specifies an attachment. This allows sites like Google Drive to
  // operate correctly (#6106).
  if (details.type === 'main_frame' && !details.url.includes('=download')) {
    return false;
  }
  var cdHeader = (details.responseHeaders &&
    getHeaderFromHeaders(details.responseHeaders, 'content-disposition'));
  return (cdHeader && /^attachment/i.test(cdHeader.value));
}

/**
 * Get the header from the list of headers for a given name.
 * @param {Array} headers responseHeaders of webRequest.onHeadersReceived
 * @return {undefined|{name: string, value: string}} The header, if found.
 */
function getHeaderFromHeaders(headers, headerName) {
  for (var i = 0; i < headers.length; ++i) {
    var header = headers[i];
    if (header.name.toLowerCase() === headerName) {
      return header;
    }
  }
}

/**
 * Check if the request is a PDF file.
 * @param {Object} details First argument of the webRequest.onHeadersReceived
 *                         event. The properties "responseHeaders" and "url"
 *                         are read.
 * @return {boolean} True if the resource is a PDF file.
 */
function isPdfFile(details) {
  var header = getHeaderFromHeaders(details.responseHeaders, 'content-type');
  if (header) {
    var headerValue = header.value.toLowerCase().split(';', 1)[0].trim();
    if (headerValue === 'application/pdf') {
      return true;
    }
    if (headerValue === 'application/octet-stream') {
      if (details.url.toLowerCase().indexOf('.pdf') > 0) {
        return true;
      }
      var cdHeader =
        getHeaderFromHeaders(details.responseHeaders, 'content-disposition');
      if (cdHeader && /\.pdf(["']|$)/i.test(cdHeader.value)) {
        return true;
      }
    }
  }
}

/**
 * Takes a set of headers, and set "Content-Disposition: attachment".
 * @param {Object} details First argument of the webRequest.onHeadersReceived
 *                         event. The property "responseHeaders" is read and
 *                         modified if needed.
 * @return {Object|undefined} The return value for the onHeadersReceived event.
 *                            Object with key "responseHeaders" if the headers
 *                            have been modified, undefined otherwise.
 */
function getHeadersWithContentDispositionAttachment(details) {
  var headers = details.responseHeaders;
  var cdHeader = getHeaderFromHeaders(headers, 'content-disposition');
  if (!cdHeader) {
    cdHeader = { name: 'Content-Disposition', };
    headers.push(cdHeader);
  }
  if (!/^attachment/i.test(cdHeader.value)) {
    cdHeader.value = 'attachment' + cdHeader.value.replace(/^[^;]+/i, '');
    return { responseHeaders: headers, };
  }
}

chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    if (details.method !== 'GET') {
      // Don't intercept POST requests until http://crbug.com/104058 is fixed.
      return;
    }
    if (!isPdfFile(details)) {
      return;
    }
    if (isPdfDownloadable(details)) {
      // Force download by ensuring that Content-Disposition: attachment is set
      return getHeadersWithContentDispositionAttachment(details);
    }

    // HACK: Add this to our cache. Workaround for Bug 1543018. See below.
    // We have to exit from here for cached URLs as for some reason redirecting
    // from onBeforeSendHeaders doesn't prevent onHeadersReceived to be called.
    if (gURLCache.includes(details.url))
      return;
    AddToCache(details.url);

    var viewerUrl = getViewerURL(details.url);

    // Implemented in preserve-referer.js
    saveReferer(details);

    return { redirectUrl: viewerUrl };
  },
  {
    urls: [
      '<all_urls>'
    ],
    types: ['main_frame', 'sub_frame'],
  },
  ['blocking', 'responseHeaders']);


// In case of a session restore there is a good chance, that our extension was
// not ready when the first tab was loaded. This results in problems when the
// last active tab was a tab with a PDF rendered by us.
browser.tabs.query({active: true}).then((tabs) => {
  for (let tab of tabs) {
    // This is the expected case. Active tab has an URL that is in context
    // of our extension URL.
    if (tab.url.indexOf(browser.extension.getURL('/')) === 0) {
      console.log("Active tab after session restore is ours. Triggering reload.");
      browser.tabs.reload(tab.id);
    }

    // And this is https://bugzil.la/1546078 :(
    // HACK!!!
    // If the active tab is "about:blank" then wait for it to finish loading.
    // If it still is "about:blank" then, then trigger reload.
    if (tab.url === "about:blank") {
      const waitint = setInterval(() => {
        browser.tabs.get(tab.id).then((rtab) => {
          if (rtab.status === "complete") {
            clearInterval(waitint);
            if (rtab.url === "about:blank") {
              console.log("Active tab after session restore is blank (https://bugzil.la/1546078). Triggering reload.");
              browser.tabs.reload(tab.id);
            }
          }
        });
      }, 200);
    }
  }
});

//
// HACK!!!
// Workaround for https://bugzil.la/1543018 follows
//
// Note: This implementation expects that that every GET request has at least
//       some "file ID" in its parameters, so we can at least be sure that the
//       URL will always point to the same file type (even if the contents
//       change).
//       If this is not the case, we will have to make this code smarter in
//       future
//

// Fetch saved URL's from storage
let gURLCache = [];
browser.storage.local.get("urlcache").then((items) => {
  if (items.urlcache)
    gURLCache = items.urlcache;
});

// Adds one URL to the cache
function AddToCache(aURL) {
  // Add new URL to the front of our cache array
  gURLCache.unshift(aURL);

  // Limit array size to 100 entries
  while(gURLCache.length > 100)
    gURLCache.pop();

  // Save to storage
  browser.storage.local.set({urlcache: gURLCache});
}

// Clears Cache
function ClearCache() {
  gURLCache = [];
  browser.storage.local.set({urlcache: gURLCache});
}

// "onBeforeRequest" and "onBeforeSendHeaders" don't seem to be affected by
// Bug 1543018.
// We can redirect there if we know that the URL will open a PDF file
// (that's what our "cache" is for).
// The event "onBeforeSendHeaders" is used as we have the Referrer there.
browser.webRequest.onBeforeSendHeaders.addListener((details) => {
  if (details.method !== 'GET')
    return;

  // Search URL in cache
  const cacheindex = gURLCache.indexOf(details.url);

  // If the URL is not known, then don't do anything
  if (cacheindex === -1)
    return

  // Sort this URL to the front of our cache array
  gURLCache.splice(cacheindex, 1);
  gURLCache.unshift(details.url);

  // "saveReferer" included here as the "onSendHeaders" in preserve-referer.js
  // will not fire if we redirect here.
  g_requestHeaders[details.requestId] = details.requestHeaders;
  saveReferer(details);

  const viewerUrl = getViewerURL(details.url);
  //console.log("Cache!!!");
  return { redirectUrl: viewerUrl };
},
{
  urls: [
    '<all_urls>'
  ],
  types: ['main_frame', 'sub_frame'],
},
['blocking', "requestHeaders"]
);
