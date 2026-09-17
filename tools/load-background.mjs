#!/usr/bin/env node
/**
 * Load the real background.js outside Chrome, in a VM with a stubbed `chrome`.
 *
 * Shared by the tools in this directory so they all exercise the shipped code
 * rather than a copy of it. Bundled files under data/ resolve off disk the way
 * the packaged extension resolves them.
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadBackground() {
  const noop = () => {};
  const chrome = {
    runtime: {
      onInstalled: { addListener: noop }, onStartup: { addListener: noop },
      onMessage: { addListener: noop },
      getURL: (p) => 'file://' + path.join(ROOT, p), lastError: null,
    },
    alarms: { onAlarm: { addListener: noop }, create: noop, get: async () => null, clear: async () => true },
    storage: { local: { get: async () => ({}), set: async () => {} } },
    notifications: { onClicked: { addListener: noop }, onButtonClicked: { addListener: noop }, create: async () => 'id' },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
    tabs: { create: async () => {}, query: async () => [] },
    windows: { create: async () => {} },
    permissions: { contains: async () => true },
  };

  // Resolve the bundled data files the way the packaged extension does
  const realFetch = fetch;
  const patchedFetch = async (url, options) => {
    const target = String(url);
    if (target.startsWith('file://')) {
      const body = fs.readFileSync(target.slice('file://'.length), 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
    }
    return realFetch(url, options);
  };

  const context = {
    chrome, fetch: patchedFetch, console, URL, URLSearchParams, TextDecoder,
    setTimeout, clearTimeout, Date, Math, JSON, isNaN, parseInt, parseFloat,
    Promise, Map, Set, Array, Object, String, Number, RegExp, Error, self: {},
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8'), context,
    { filename: 'background.js' });
  return context;
}

