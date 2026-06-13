# Retainer Tracker PWA

## 1. Project Overview

Build a lightweight, mobile-first Progressive Web App (PWA) to track daily retainer wear time. The app allows the user to clock in and out using a single button, automatically calculates daily progress against a target goal, and stores all data locally.

**Tech Stack:** Plain HTML5, CSS3, Vanilla JavaScript. No frameworks or external libraries.
**Primary Color Palette:** Purple (Brand color), White, Light Gray (for backgrounds/cards).
**Data Storage:** `localStorage`.
**Hosting Environment:** GitHub Pages.

## 2. File Structure

The project must consist of the following minimal file structure:

* `index.html` (Main screen)
* `history.html` (Historical data and management)
* `style.css` (Shared mobile-first styling)
* `app.js` (Core logic for both pages)
* `manifest.json` (PWA configuration)
* `sw.js` (Service Worker for offline capability, installability, and cache management)
* `package.json` (For deployment scripts)

## 3. Data Model (`localStorage`)

Data must be stored in `localStorage` under the key `retainerData`. The structure must be a JSON object where keys are ISO date strings (`YYYY-MM-DD` based on local timezone).

```json
{
  "targetHours": 4,
  "history": {
    "2023-10-25": {
      "sessions": [
        { "start": "2023-10-25T08:00:00.000Z", "end": "2023-10-25T11:00:00.000Z" },
        { "start": "2023-10-25T14:00:00.000Z", "end": null } 
      ]
    }
  }
}

```

*Note: An `end` value of `null` indicates the user is currently "Checked In".*

## 4. Main Page (`index.html`) Requirements

**UI Layout:**

* Clean, highly legible mobile-first interface.
* **Header:** App title and a link/icon to navigate to "History".
* **Progress Display:** A large, centralized display showing:
* Total time logged today in **HH:MM:SS** format.
* Time remaining to hit the daily target.
* A visual progress indicator (e.g., a circular progress bar or horizontal fill bar in purple).


* **Main Action:** A prominent, large, single toggle button (minimum 44x44px touch target):
* State 1: "Check In" (when not wearing the retainer).
* State 2: "Check Out" (when wearing the retainer). Visual style should change (e.g., solid purple to outlined purple).



**Core Logic:**

* **Auto-Day Detection:** Check the current system date on load. If the current date differs from the last logged date, automatically start a new day.
* **Accurate Timekeeping:** Do NOT rely on `setInterval` to accumulate time, as mobile browsers will throttle background tabs.
* Store the exact start timestamp (`Date.now()`).
* Use `setInterval` (e.g., every 1000ms) *only* to update the DOM by calculating the difference between the current system time and the start timestamp.


* **Background Handling:** Implement `document.addEventListener("visibilitychange")`. When `document.visibilityState === 'visible'`, immediately recalculate and update the UI to prevent lag from throttled timers.
* **Midnight Crossover Handling:** If a session crosses midnight (e.g., 23:00 to 01:00), the logic must split the session, assigning the correct duration to the previous day and the remainder to the new day.

## 5. History Page (`history.html`) Requirements

**UI Layout:**

* **Header:** "History" title and a "Back to Today" link.
* **List View:** A reverse-chronological list of past days.
* Display the date, total time logged, and whether the goal was met.


* **Edit Functionality:** Tapping a day expands it to reveal specific start/end sessions.
* Provide plain HTML `<input type="time">` or `<input type="datetime-local">` fields to allow manual correction of `start` and `end` times.
* Include a "Delete Session" button for each interval.
* Changes must recalculate that day's total and immediately save to `localStorage`.


* **Data Management (Bottom):**
* "Export Data": Downloads the `localStorage` JSON object as a `.json` file.
* "Import Data": A file input that accepts a `.json` file, parses it, merges/overwrites current `localStorage`, and refreshes the UI.



## 6. GitHub Pages Deployment & Pathing (CRITICAL)

Because the app will be hosted on a GitHub Pages subpath (`https://[username].github.io/[repo-name]/`), the following pathing rules are absolute:

* **Relative Paths:** All asset links in HTML files and `sw.js` **must use relative paths** (e.g., `./style.css`, `./app.js`, `./history.html`). Never use absolute root paths (e.g., `/style.css`).
* **Manifest:** The `start_url` in `manifest.json` must be set to `./`.
* **Service Worker Scope:** The Service Worker registration in `app.js` must be explicitly configured to work on the subpath.
* **Package.json:** Include the following script for deployment:
```json
"scripts": {
  "deploy": "gh-pages -d ."
}

```



## 7. PWA, Caching & Service Worker (`sw.js`)

* **`manifest.json`:** Must include `name`, `short_name`, `display` (`standalone`), `background_color`, `theme_color` (purple), and an `icons` array.
* **Offline Capability:** The Service Worker must cache core static assets (`index.html`, `history.html`, `style.css`, `app.js`, `manifest.json`).
* **Cache Busting:** Implement a cache versioning mechanism (e.g., `const CACHE_NAME = 'retainer-v1';`). The `activate` event must delete outdated caches.
* **Update Notification:** Add logic in `app.js` to detect when a new Service Worker is waiting. Display a subtle "Update Available - Refresh" banner to the user to apply updates pushed to GitHub Pages.

## 8. Edge Case Handling

* **Forgotten Checkout:** Provide a way to manually stop a "runaway" session (e.g., if a session runs over 12 hours, prompt the user to confirm or edit the checkout time).
* **Overlapping Edits:** When editing history, enforce validation to prevent the user from creating overlapping sessions on the same day.
