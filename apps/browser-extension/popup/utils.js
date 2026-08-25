/* eslint-disable no-console */
/// <reference path="../popup.d.ts" />
/// <reference path="../../playlist-manager/src/types/services.d.ts" />

/**
 * @typedef {import("webextension-polyfill").Tabs.Tab} Tab
 */

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
export function getById(id) {
  // @ts-ignore
  return document.getElementById(id);
}

/**
 * @param {HTMLElement} element
 * @param {string} className
 */
export function setIcon(element, className) {
  element.textContent = "";
  const i = document.createElement("i");
  i.className = className;
  element.appendChild(i);
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

/**
 * @param {unknown} e
 * @returns {string}
 */
export const getErrorMessage = (e) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/**
 * @param {T | null | undefined} argument
 * @returns {argument is T}
 * @template T
 */
export function isNotNull(argument) {
  return argument != null;
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

/**
 * @param {string[]} array
 * @returns {string[]}
 */
export function removeDuplicates(array) {
  return Array.from(new Set(array));
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/**
 * @param {string} message
 * @param {boolean} [isInfo]
 */
export async function alert(message, isInfo) {
  const isAndroid = /Android/i.test(navigator.userAgent);
  browser.notifications.create({
    type: "basic",
    title: "Playlist Manager" + (isInfo ? "" : ": Error"),
    message: message,
    ...(isAndroid ? {} : { iconUrl: "../assets/icons/icon_48.png" }),
  });
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/**
 * @param {"INFO" | "ERROR" | "WARN"} level
 * @param {string} message
 * @param {any} [details]
 */
export async function log(level, message, details = null) {
  if (window.logSystemEvent) {
    try {
      await window.logSystemEvent(level, message, details);
    } catch (e) {
      console.error("Failed to log to system logs:", getErrorMessage(e));
    }
  }
}

// ---------------------------------------------------------------------------
// YouTube URL regex
// ---------------------------------------------------------------------------

export const YOUTUBE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?youtu(?:\.be\/|be.com\/\S*(?:watch|embed|shorts)(?:(?:(?=\/[-a-zA-Z0-9_]{11,}(?!\S))\/)|(?:\S*v=|v\/)))([-a-zA-Z0-9_]{11,})/;
