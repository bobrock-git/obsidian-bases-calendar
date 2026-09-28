import { Platform } from "obsidian";

/**
 * Phone layout switch. `localStorage["bases-calendar-debug-phone"] = "1"`
 * forces the phone code path on desktop, so the phone toolbar and move mode
 * can be reproduced in a live vault without mobile emulation (which hangs
 * desktop-only plugins). Read once per render; never set by the plugin.
 */
export function isPhoneLayout(): boolean {
  if (Platform.isPhone) return true;
  try {
    return window.localStorage.getItem("bases-calendar-debug-phone") === "1";
  } catch {
    return false;
  }
}
