(() => {
    "use strict";

    const BUTTON_CLASS = "cgpt-copy-md-btn";
    const FOLDABLE_BUTTON_CLASS = "cgpt-foldable-btn";
    const PROCESSED_ATTR = "data-copy-md-attached";
    const FOLDED_ATTR = "data-folded";
    const FOLDED_CLASS = "cgpt-folded";

    let foldableEnabled = false;

    /**
     * Initialize extension settings
     */
    function initSettings() {
        chrome.storage.sync.get(['foldableAnswers', 'autoFoldOnLoad'], function (result) {
            const wasFoldableEnabled = foldableEnabled;
            foldableEnabled = result.foldableAnswers || false;
            const autoFoldEnabled = result.autoFoldOnLoad || false;

            console.log('Extension settings loaded:', { foldableEnabled, autoFoldEnabled, wasFoldableEnabled });

            // If foldable was just enabled, inject buttons for existing messages
            if (foldableEnabled && !wasFoldableEnabled) {
                injectFoldableButtons();
            }

            // Auto-fold answers if enabled
            if (foldableEnabled && autoFoldEnabled) {
                console.log('Auto-fold enabled, scheduling fold');
                // Schedule auto-fold after a longer delay to ensure everything is loaded
                setTimeout(() => {
                    console.log('Executing auto-fold');
                    const result = foldAllMessages();
                    console.log('Auto-fold completed, folded', result.count, 'messages');
                }, 4000); // Increased delay
            }
        });
    }

    /**
     * Listen for messages from popup
     */
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.action === 'toggleFoldable') {
            foldableEnabled = request.enabled;
            if (foldableEnabled) {
                injectFoldableButtons();
            } else {
                removeFoldableButtons();
            }
        } else if (request.action === 'foldAll') {
            const result = foldAllMessages();
            sendResponse({ success: true, action: 'folded', count: result.count });
        } else if (request.action === 'unfoldAll') {
            const result = unfoldAllMessages();
            sendResponse({ success: true, action: 'unfolded', count: result.count });
        }
    });

    /**
     * Observe ChatGPT DOM for new assistant messages
     */
    function initObserver() {
        let timeoutId;
        const observer = new MutationObserver(() => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                injectButtons();
                // Always try to inject foldable buttons - they'll only work if enabled
                injectFoldableButtons();
            }, 100);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        injectButtons(); // initial run
        initSettings(); // load settings
    }

    /**
     * Inject copy buttons into assistant messages
     */
    function injectButtons() {
        const assistantMessages = findAssistantMessages();

        assistantMessages.forEach((message) => {
            if (message.hasAttribute(PROCESSED_ATTR)) return;

            const button = createCopyButton(message);
            attachButton(message, button);

            message.setAttribute(PROCESSED_ATTR, "true");
        });
    }

    /**
     * Inject foldable buttons into assistant messages
     */
    function injectFoldableButtons() {
        if (!foldableEnabled) return;

        const assistantMessages = findAssistantMessages();

        assistantMessages.forEach((message) => {
            if (message.hasAttribute("data-foldable-attached")) return;

            const foldableButton = createFoldableButton(message);
            attachButton(message, foldableButton);

            message.setAttribute("data-foldable-attached", "true");
        });
    }

    /**
     * Remove foldable buttons from assistant messages
     */
    function removeFoldableButtons() {
        const foldableButtons = document.querySelectorAll(`.${FOLDABLE_BUTTON_CLASS}`);
        foldableButtons.forEach(button => button.remove());

        // Remove foldable attributes and classes
        const assistantMessages = findAssistantMessages();
        assistantMessages.forEach(message => {
            message.removeAttribute("data-foldable-attached");

            // Find and unfold any folded content
            const article = message.closest("article");
            if (article) {
                // Use the same logic as toggleFold to find content div
                let contentDiv = article.querySelector("div[data-message-id]") ||
                    article.querySelector("div.markdown") ||
                    article.querySelector("div.prose") ||
                    article.querySelector("div[data-testid*='conversation-turn']");

                if (!contentDiv) {
                    const children = Array.from(article.children);
                    contentDiv = children.find(child =>
                        child.textContent && child.textContent.length > 50 &&
                        !child.classList.contains('cgpt-copy-md-btn') &&
                        !child.classList.contains('cgpt-foldable-btn')
                    );
                }

                if (contentDiv) {
                    contentDiv.removeAttribute(FOLDED_ATTR);
                    contentDiv.classList.remove(FOLDED_CLASS);

                    // Remove overlay
                    const overlay = contentDiv.querySelector('.cgpt-folded-overlay');
                    if (overlay) {
                        overlay.remove();
                    }
                }
            }
        });
    }

    /**
     * Locate button containers in assistant messages
     * (find the div where action buttons are placed)
     */
    function findAssistantMessages() {
        return Array.from(
            document.querySelectorAll("div.z-0.flex.min-h-\\[46px\\].justify-start")
        );
    }

    /**
     * Create copy button
     */
    function createCopyButton(messageEl) {
        const btn = document.createElement("button");
        btn.className = "text-token-text-secondary hover:bg-token-bg-secondary rounded-lg cgpt-copy-md-btn";
        btn.type = "button";
        btn.setAttribute("aria-label", "Copy Markdown");
        btn.setAttribute("data-testid", "copy-markdown-turn-action-button");

        // Create the inner span with icon
        const span = document.createElement("span");
        span.className = "flex items-center justify-center touch:w-10 h-8 w-8";

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("width", "20");
        svg.setAttribute("height", "20");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("class", "icon");

        const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
        use.setAttribute("href", "/cdn/assets/sprites-core-k5zux585.svg#ce3544");
        use.setAttribute("fill", "currentColor");

        svg.appendChild(use);
        span.appendChild(svg);
        btn.appendChild(span);

        btn.addEventListener("click", async (e) => {
            e.stopPropagation();

            // Find the message container (article) from the button container
            const article = messageEl.closest("article");
            if (!article) return;

            const originalInnerHTML = span.innerHTML;

            try {
                const markdown = htmlToMarkdown(article);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(markdown);
                } else {
                    // Fallback for older browsers
                    const textArea = document.createElement("textarea");
                    textArea.value = markdown;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand("copy");
                    document.body.removeChild(textArea);
                }

                // Visual feedback: show checkmark
                span.innerHTML = "✓";
                span.style.color = "#00ff00";
                btn.style.backgroundColor = "#00ff00";
                btn.style.borderColor = "#00ff00";
                btn.style.boxShadow = "0 0 10px #00ff00";
                btn.style.transform = "scale(0.9)";
                setTimeout(() => {
                    span.innerHTML = originalInnerHTML;
                    span.style.color = "";
                    btn.style.backgroundColor = "";
                    btn.style.borderColor = "";
                    btn.style.boxShadow = "";
                    btn.style.transform = "";
                }, 2000);
            } catch (error) {
                console.error("Copy failed:", error);
                // Visual feedback: show X
                span.innerHTML = "✗";
                span.style.color = "#ff0000";
                btn.style.backgroundColor = "#ff0000";
                btn.style.borderColor = "#ff0000";
                btn.style.boxShadow = "0 0 10px #ff0000";
                btn.style.transform = "scale(0.9)";
                setTimeout(() => {
                    span.innerHTML = originalInnerHTML;
                    span.style.color = "";
                    btn.style.backgroundColor = "";
                    btn.style.borderColor = "";
                    btn.style.boxShadow = "";
                    btn.style.transform = "";
                }, 2000);
            }
        });

        return btn;
    }

    /**
     * Create foldable toggle button
     */
    function createFoldableButton(messageEl) {
        const btn = document.createElement("button");
        btn.className = `text-token-text-secondary hover:bg-token-bg-secondary rounded-lg ${FOLDABLE_BUTTON_CLASS}`;
        btn.type = "button";
        btn.setAttribute("aria-label", "Toggle fold");
        btn.setAttribute("data-testid", "foldable-turn-action-button");

        // Create the inner span with icon
        const span = document.createElement("span");
        span.className = "flex items-center justify-center touch:w-10 h-8 w-8";

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("width", "20");
        svg.setAttribute("height", "20");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("class", "icon");

        // Create path for chevron down icon
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M5 7l5 5 5-5z");
        path.setAttribute("fill", "currentColor");

        svg.appendChild(path);
        span.appendChild(svg);
        btn.appendChild(span);

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleFold(messageEl, btn);
        });

        return btn;
    }

    /**
     * Toggle fold state of a message
     */
    function toggleFold(messageEl, button) {
        try {
            // Find the message content area (the div containing the actual response text)
            const article = messageEl.closest("article");
            if (!article) return;

            // Look for the content div within the article - try multiple selectors
            let contentDiv = article.querySelector("div[data-message-id]") ||
                article.querySelector("div.markdown") ||
                article.querySelector("div.prose") ||
                article.querySelector("div[data-testid*='conversation-turn']");

            // Fallback: find the main content area by looking for text content
            if (!contentDiv) {
                const children = Array.from(article.children);
                contentDiv = children.find(child =>
                    child.textContent && child.textContent.length > 50 &&
                    !child.classList.contains('cgpt-copy-md-btn') &&
                    !child.classList.contains('cgpt-foldable-btn')
                );
            }

            if (!contentDiv) return;

            const isFolded = contentDiv.hasAttribute(FOLDED_ATTR);

            if (isFolded) {
                // Expand
                contentDiv.removeAttribute(FOLDED_ATTR);
                contentDiv.classList.remove(FOLDED_CLASS);
                updateFoldIcon(button, false);

                // Remove overlay
                const overlay = contentDiv.querySelector('.cgpt-folded-overlay');
                if (overlay) {
                    overlay.remove();
                }
            } else {
                // Collapse
                contentDiv.setAttribute(FOLDED_ATTR, "true");
                contentDiv.classList.add(FOLDED_CLASS);
                updateFoldIcon(button, true);

                // Add overlay
                const overlay = document.createElement('div');
                overlay.className = 'cgpt-folded-overlay';
                overlay.innerHTML = `
                    <div class="expand-text">
                        <svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6,9 12,15 18,9"></polyline>
                        </svg>
                        Show more
                    </div>
                `;

                // Make overlay clickable
                overlay.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleFold(messageEl, button);
                });

                contentDiv.appendChild(overlay);
            }
        } catch (error) {
            console.error("Error toggling fold:", error);
        }
    }

    /**
     * Update the fold button icon
     */
    function updateFoldIcon(button, isFolded) {
        const path = button.querySelector("path");
        if (path) {
            path.setAttribute("d", isFolded ? "M7 5l5 5 5-5z" : "M5 7l5 5 5-5z");
        }
    }

    /**
     * Fold all messages
     */
    function foldAllMessages() {
        console.log('foldAllMessages called');
        if (!foldableEnabled) return { count: 0 };

        let foldedCount = 0;
        const assistantMessages = findAssistantMessages();
        console.log('Found', assistantMessages.length, 'assistant messages');

        assistantMessages.forEach((message, index) => {
            // Ensure foldable button exists
            let foldableButton = message.querySelector(`.${FOLDABLE_BUTTON_CLASS}`);
            if (!foldableButton) {
                foldableButton = createFoldableButton(message);
                attachButton(message, foldableButton);
                message.setAttribute("data-foldable-attached", "true");
            }

            if (foldableButton) {
                // Only fold if not already folded
                const article = message.closest("article");
                if (article) {
                    const contentDiv = findContentDiv(article);
                    if (contentDiv && !contentDiv.hasAttribute(FOLDED_ATTR)) {
                        toggleFold(message, foldableButton);
                        foldedCount++;
                    }
                }
            }
        });
        return { count: foldedCount };
    }

    /**
     * Unfold all messages
     */
    function unfoldAllMessages() {
        if (!foldableEnabled) return { count: 0 };

        let unfoldedCount = 0;
        const assistantMessages = findAssistantMessages();
        assistantMessages.forEach((message) => {
            const foldableButton = message.querySelector(`.${FOLDABLE_BUTTON_CLASS}`);
            if (foldableButton) {
                // Only unfold if currently folded
                const article = message.closest("article");
                if (article) {
                    const contentDiv = findContentDiv(article);
                    if (contentDiv && contentDiv.hasAttribute(FOLDED_ATTR)) {
                        toggleFold(message, foldableButton);
                        unfoldedCount++;
                    }
                }
            }
        });
        return { count: unfoldedCount };
    }

    /**
     * Find content div within an article (helper function)
     */
    function findContentDiv(article) {
        let contentDiv = article.querySelector("div[data-message-id]") ||
            article.querySelector("div.markdown") ||
            article.querySelector("div.prose") ||
            article.querySelector("div[data-testid*='conversation-turn']");

        // Fallback: find the main content area by looking for text content
        if (!contentDiv) {
            const children = Array.from(article.children);
            contentDiv = children.find(child =>
                child.textContent && child.textContent.length > 50 &&
                !child.classList.contains('cgpt-copy-md-btn') &&
                !child.classList.contains('cgpt-foldable-btn')
            );
        }

        return contentDiv;
    }

    /**
     * Attach button to the buttons container
     */
    function attachButton(container, button) {
        container.appendChild(button);
    }

    /**
     * Convert assistant message HTML to Markdown
     */
    function htmlToMarkdown(container) {
        const clone = container.cloneNode(true);

        // remove buttons or UI noise
        clone.querySelectorAll(`.${BUTTON_CLASS}`).forEach((el) => el.remove());
        clone.querySelectorAll('button').forEach((el) => el.remove());

        // remove ChatGPT header
        clone.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((header) => {
            if (header.textContent.trim().toLowerCase().includes("chatgpt said")) {
                header.remove();
            }
        });

        return convertNode(clone, '').trim();
    }

    /**
     * Recursive DOM → Markdown conversion
     */
    function convertNode(node, indent = '') {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return "";
        }

        const tag = node.tagName.toLowerCase();
        const content = Array.from(node.childNodes)
            .map(n => convertNode(n, indent))
            .join("");

        switch (tag) {
            case "h1": return `${indent}# ${content}\n\n`;
            case "h2": return `${indent}## ${content}\n\n`;
            case "h3": return `${indent}### ${content}\n\n`;
            case "h4": return `${indent}#### ${content}\n\n`;
            case "h5": return `${indent}##### ${content}\n\n`;
            case "h6": return `${indent}###### ${content}\n\n`;

            case "p": return `${indent}${content}\n`;

            case "strong":
            case "b": return content.split('\n').filter(line => line.trim()).map(line => `**${line}**`).join('\n');

            case "em":
            case "i": return content.split('\n').filter(line => line.trim()).map(line => `*${line}*`).join('\n');

            case "code":
                if (node.parentElement?.tagName.toLowerCase() === "pre") {
                    return content;
                }
                return `\`${content}\``;

            case "pre":
                let lang = '';
                const codeEl = node.querySelector('code');
                if (codeEl) {
                    const match = codeEl.className.match(/language-(\w+)/);
                    if (match) lang = match[1];
                }
                return `${indent}\`\`\`${lang}\n${content}\n\`\`\`\n\n`;

            case "ul":
                return (
                    Array.from(node.children)
                        .map((li) => `${indent}- ${convertNode(li, indent + '    ').trim()}`)
                        .join("\n")
                );

            case "ol":
                return (
                    Array.from(node.children)
                        .map((li, i) => `${indent}${i + 1}. ${convertNode(li, indent + '    ').trim()}`)
                        .join("\n\n")
                );

            case "li":
                return Array.from(node.childNodes).map(n => convertNode(n, indent)).join("").trim().replace(/\n+$/, "");

            case "a":
                const href = node.getAttribute("href") || "";
                return `[${content}](${href})`;

            case "br":
                return "\n";

            default:
                return content;
        }
    }

    /**
     * Boot
     */
    initObserver();
})();
