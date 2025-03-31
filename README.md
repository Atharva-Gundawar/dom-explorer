# DOM Element Highlighter Chrome Extension

This Chrome extension allows you to visualize all DOM elements on a webpage by drawing bounding boxes around them. It's useful for understanding the structure and layout of web pages.

## Features

- Draws colored bounding boxes around all visible DOM elements
- Toggle highlighting with a keyboard shortcut
- Each element gets a unique random color
- Semi-transparent overlay to see the content underneath

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing these files

## Usage

1. Navigate to any webpage
2. Press `Command+Shift+H` (Mac) or `Ctrl+Shift+H` (Windows/Linux) to toggle the highlighting
3. Press the shortcut again to remove the highlighting

## Files

- `manifest.json`: Extension configuration
- `content.js`: Handles DOM manipulation and drawing
- `background.js`: Handles keyboard shortcuts
- `icons/`: Contains extension icons

## Note

The extension will highlight all visible DOM elements on the page. Elements with zero dimensions (width or height) will be skipped. 