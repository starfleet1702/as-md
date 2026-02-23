// Popup script for ChatGPT Enhancer extension
document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.getElementById('foldable-toggle');
    const autoFoldToggle = document.getElementById('auto-fold-toggle');
    const foldAllBtn = document.getElementById('fold-all-btn');
    let foldableEnabled = false;
    let autoFoldEnabled = false;
    let allFolded = false;
    let isOnChatGPT = false;

    // Check if we're on a ChatGPT page
    function checkChatGPTUrl() {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs && tabs[0] && tabs[0].url) {
                const url = tabs[0].url;
                try {
                    const urlObj = new URL(url);
                    isOnChatGPT = urlObj.hostname === 'chat.openai.com' ||
                        urlObj.hostname === 'chatgpt.com' ||
                        urlObj.hostname.endsWith('.chat.openai.com') ||
                        urlObj.hostname.endsWith('.chatgpt.com');
                } catch (e) {
                    // Fallback to includes check
                    isOnChatGPT = url.includes('chat.openai.com') || url.includes('chatgpt.com');
                }
            } else {
                isOnChatGPT = false;
            }
            updateFoldAllButton();
        });
    }

    // Initial check
    checkChatGPTUrl();

    // Re-check after a short delay in case the tab URL wasn't loaded yet
    setTimeout(checkChatGPTUrl, 500);
    // Load current settings
    chrome.storage.sync.get(['foldableAnswers', 'autoFoldOnLoad'], function (result) {
        foldableEnabled = result.foldableAnswers || false;
        autoFoldEnabled = result.autoFoldOnLoad || false;
        toggle.checked = foldableEnabled;
        autoFoldToggle.checked = autoFoldEnabled;
        updateFoldAllButton();
    });

    // Save setting when toggle changed
    toggle.addEventListener('change', function () {
        foldableEnabled = toggle.checked;
        chrome.storage.sync.set({
            foldableAnswers: foldableEnabled
        }, function () {
            // Notify content script of the change
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs && tabs[0] && tabs[0].url && (tabs[0].url.includes('chat.openai.com') || tabs[0].url.includes('chatgpt.com'))) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'toggleFoldable',
                        enabled: foldableEnabled
                    });
                }
            });
            updateFoldAllButton();
        });
    });

    // Save auto-fold setting when toggle changed
    autoFoldToggle.addEventListener('change', function () {
        autoFoldEnabled = autoFoldToggle.checked;
        chrome.storage.sync.set({
            autoFoldOnLoad: autoFoldEnabled
        });
    });

    // Handle fold/unfold all button
    foldAllBtn.addEventListener('click', function () {
        if (!foldableEnabled || !isOnChatGPT) return;

        const action = allFolded ? 'unfoldAll' : 'foldAll';

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs && tabs[0] && tabs[0].url && (tabs[0].url.includes('chat.openai.com') || tabs[0].url.includes('chatgpt.com'))) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: action
                }, function (response) {
                    if (response && response.success && response.count > 0) {
                        allFolded = response.action === 'folded';
                        updateFoldAllButton();
                    }
                });
            }
        });
    });

    function updateFoldAllButton() {
        if (!foldableEnabled || !isOnChatGPT) {
            foldAllBtn.disabled = true;
            foldAllBtn.textContent = 'Fold All Answers';
            foldAllBtn.title = !isOnChatGPT ? 'Only works on ChatGPT pages' : '';
            return;
        }

        foldAllBtn.disabled = false;
        foldAllBtn.textContent = allFolded ? 'Unfold All Answers' : 'Fold All Answers';
        foldAllBtn.title = '';
    }
});
