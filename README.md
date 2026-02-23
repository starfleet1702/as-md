# ChatGPT Copy as Markdown & Foldable Answers

A Chrome extension that enhances ChatGPT with two main features:

## Features

### 1. Copy as Markdown
- Adds a blue "Copy Markdown" button to each ChatGPT assistant response
- Converts HTML content to clean Markdown format
- Supports headers, lists, code blocks, links, and formatting

### 2. Foldable Answers (Toggleable)
- Adds a green "Fold" button to collapse/expand long responses
- Helps organize chat conversations by hiding lengthy content
- Can be toggled on/off via the extension popup- **Auto-fold on Load**: Automatically fold all answers when ChatGPT page loads- **Bulk Actions**: "Fold All Answers" / "Unfold All Answers" button in popup for quick organization

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select this folder
5. The extension should now be installed

## Usage

### Copy as Markdown
- Click the blue button (📄) next to any ChatGPT response
- The response will be copied to your clipboard in Markdown format

### Foldable Answers
- Click the extension icon in the toolbar to open the popup
- Toggle "Foldable Answers" on/off to enable/disable the feature
- Toggle "Auto-fold on Load" to automatically fold answers when ChatGPT pages load
- When enabled, a green chevron button (∨) appears next to each response
- Click the chevron to collapse/expand individual responses
- Use "Fold All Answers" button to collapse all responses at once (only available on ChatGPT pages)
- Use "Unfold All Answers" button to expand all responses at once (only available on ChatGPT pages)
- Collapsed responses show a preview with an interactive "Show more" button

## Technical Details

### Files
- `manifest.json` - Extension configuration
- `content.js` - Main content script with both features
- `popup.html` & `popup.js` - Settings popup for toggling features
- `styles.css` - Styling for buttons and folded states

### Architecture
- **Modular Design**: Features are separated into distinct functions
- **Toggleable**: Foldable functionality can be enabled/disabled
- **Auto-fold**: Automatically fold answers on page load (configurable)
- **Non-intrusive**: Uses Chrome storage API for settings persistence
- **Responsive**: Adapts to ChatGPT's dynamic DOM updates

### Permissions
- `clipboardWrite` - For copying markdown to clipboard
- `storage` - For saving toggle settings
- `tabs` - For detecting ChatGPT pages in the popup

## Development

The code is organized with clear separation of concerns:
- Button creation and injection functions
- DOM manipulation and event handling
- Settings management via Chrome storage API
- CSS for visual styling and animations

## Compatibility

Works with:
- https://chat.openai.com/*
- https://chatgpt.com/*
