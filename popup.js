document.addEventListener('DOMContentLoaded', () => {
    const apiKeySection = document.getElementById('apiKeySection');
    const mainSection = document.getElementById('mainSection');
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyBtn = document.getElementById('saveKeyBtn');
    const summarizeBtn = document.getElementById('summarizeBtn');
    const summarizeAgainBtn = document.getElementById('summarizeAgainBtn');
    const copyBtn = document.getElementById('copyBtn');
    const manageKeyBtn = document.getElementById('manageKeyBtn');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');
    const summaryBody = document.getElementById('summaryBody');
    const takeawaysBody = document.getElementById('takeawaysBody');
    const errorDiv = document.getElementById('error');

    const loadingText = document.getElementById('loadingText');

    // Check for existing API key
    chrome.storage.local.get(['openaiApiKey'], (result) => {
        if (result.openaiApiKey) {
            showMainSection();
            checkCache();
        } else {
            showApiKeySection();
        }
    });

    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            chrome.storage.local.set({ openaiApiKey: key }, () => {
                showMainSection();
                checkCache();
            });
        }
    });

    manageKeyBtn.addEventListener('click', () => {
        chrome.storage.local.get(['openaiApiKey'], (result) => {
            if (result.openaiApiKey) {
                // Has key, so this is "Remove API Key"
                chrome.storage.local.remove(['openaiApiKey'], () => {
                    apiKeyInput.value = '';
                    showApiKeySection();
                    manageKeyBtn.textContent = "Add API Key"; // Should not be visible in main section usually, but for safety
                });
            } else {
                // No key (unlikely to be here if main section is shown, but logic holds)
                showApiKeySection();
            }
        });
    });

    let currentData = null;

    summarizeBtn.addEventListener('click', () => {
        performSummarization(false);
    });

    summarizeAgainBtn.addEventListener('click', () => {
        performSummarization(true);
    });

    copyBtn.addEventListener('click', async () => {
        if (!currentData) return;

        const summaryText = currentData.summary || '';
        const takeawaysText = currentData.takeaways || '';

        // Plain text (Markdown)
        const plainText = `### Summary\n${summaryText}\n\n### Key Takeaways\n${takeawaysText}`;

        // HTML
        const htmlContent = `
            <h3>Summary</h3>
            ${marked.parse(summaryText)}
            <h3>Key Takeaways</h3>
            ${marked.parse(takeawaysText)}
        `;

        try {
            const textBlob = new Blob([plainText], { type: 'text/plain' });
            const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/plain': textBlob,
                    'text/html': htmlBlob
                })
            ]);

            const originalText = copyBtn.textContent;
            copyBtn.textContent = "✅ Copied!";
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            showError('Failed to copy to clipboard');
        }
    });

    let abortController = null;

    async function performSummarization(forceRefresh) {
        hideError();
        showLoading();
        resultDiv.classList.add('hidden');
        summarizeBtn.classList.add('hidden'); // Ensure this is hidden
        summarizeAgainBtn.classList.add('hidden');
        copyBtn.classList.add('hidden');

        // Create new AbortController
        if (abortController) {
            abortController.abort();
        }
        abortController = new AbortController();
        const signal = abortController.signal;

        try {
            const tab = await getCurrentTab();
            if (!tab || !tab.url) {
                throw new Error('Cannot get current tab URL.');
            }

            const cleanedUrl = cleanUrl(tab.url);
            const cacheKey = `summary_${cleanedUrl}`;

            if (!forceRefresh) {
                // Try to get from cache first
                const cached = await getFromCache(cacheKey);
                if (cached && cached.data) {
                    displaySummary(cached.data, cached.timestamp);
                    hideLoading();
                    return;
                }
            }

            updateLoadingText("Requiring raw content...");
            const jinaUrl = `https://r.jina.ai/${encodeURIComponent(tab.url)}`;

            // Fetch content from Jina
            const jinaResponse = await fetch(jinaUrl, { signal });
            if (!jinaResponse.ok) {
                throw new Error(`Failed to fetch content from Jina.ai: ${jinaResponse.statusText}`);
            }
            const rawText = await jinaResponse.text();

            // Get API Key
            chrome.storage.local.get(['openaiApiKey'], async (result) => {
                if (signal.aborted) return; // Check if aborted before proceeding

                const apiKey = result.openaiApiKey;
                if (!apiKey) {
                    showError('API Key not found. Please set it again.');
                    showApiKeySection();
                    hideLoading(); // Ensure loading is hidden if we return early
                    return;
                }

                try {
                    updateLoadingText("Requiring summary...");
                    const data = await summarizeWithOpenAI(apiKey, rawText, signal);
                    const timestamp = Date.now();
                    // Cache the result
                    chrome.storage.local.set({ [cacheKey]: { data, timestamp } });
                    displaySummary(data, timestamp);
                } catch (err) {
                    if (err.name === 'AbortError') {
                        // Do nothing or show aborted state? 
                        // Usually just resetting UI is fine, or showing "Aborted"
                        console.log('Fetch aborted');
                    } else {
                        showError(`OpenAI Error: ${err.message}`);
                    }
                } finally {
                    if (!signal.aborted) {
                        hideLoading();
                    }
                }
            });

        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('Fetch aborted');
                hideLoading(); // Ensure loading is hidden on abort
                summarizeBtn.classList.remove('hidden'); // Allow retry
            } else {
                showError(err.message);
                hideLoading();
                summarizeBtn.classList.remove('hidden'); // Allow retry
            }
        }
    }

    function showApiKeySection() {
        apiKeySection.classList.remove('hidden');
        mainSection.classList.add('hidden');
    }

    function showMainSection() {
        apiKeySection.classList.add('hidden');
        mainSection.classList.remove('hidden');
        updateManageKeyButton();
    }

    function updateManageKeyButton() {
        chrome.storage.local.get(['openaiApiKey'], (result) => {
            if (result.openaiApiKey) {
                manageKeyBtn.textContent = "Remove API Key";
            } else {
                manageKeyBtn.textContent = "Add API Key";
            }
        });
    }

    function updateLoadingText(text) {
        loadingText.textContent = text;
    }

    function showLoading() {
        loadingDiv.classList.remove('hidden');
        summarizeBtn.disabled = true;
        summarizeAgainBtn.disabled = true;
        copyBtn.disabled = true;
    }

    function hideLoading() {
        loadingDiv.classList.add('hidden');
        summarizeBtn.disabled = false;
        summarizeAgainBtn.disabled = false;
        copyBtn.disabled = false;
    }

    function displaySummary(data, timestamp) {
        currentData = data;
        // Parse markdown using marked
        summaryBody.innerHTML = marked.parse(data.summary || '');
        takeawaysBody.innerHTML = marked.parse(data.takeaways || '');

        const timestampDiv = document.getElementById('timestamp');
        if (timestamp) {
            const date = new Date(timestamp);
            timestampDiv.textContent = `Generated on ${date.toLocaleString()}`;
            timestampDiv.classList.remove('hidden');
        } else {
            timestampDiv.classList.add('hidden');
        }

        resultDiv.classList.remove('hidden');
        summarizeBtn.classList.add('hidden'); // Hide original summarize button
        summarizeAgainBtn.classList.remove('hidden'); // Show summarize again

        if (data.summary || data.takeaways) {
            copyBtn.classList.remove('hidden'); // Show copy button only if content exists
        } else {
            copyBtn.classList.add('hidden');
        }
    }

    function showError(msg) {
        errorDiv.textContent = msg;
        errorDiv.classList.remove('hidden');
    }

    function hideError() {
        errorDiv.classList.add('hidden');
    }

    async function getCurrentTab() {
        let queryOptions = { active: true, lastFocusedWindow: true };
        let [tab] = await chrome.tabs.query(queryOptions);
        return tab;
    }

    function getFromCache(key) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key]);
            });
        });
    }

    async function checkCache() {
        const tab = await getCurrentTab();
        if (tab && tab.url) {
            const cleanedUrl = cleanUrl(tab.url);
            const cacheKey = `summary_${cleanedUrl}`;
            const cached = await getFromCache(cacheKey);
            if (cached && cached.data) {
                displaySummary(cached.data, cached.timestamp);
            } else {
                // No cache, auto-trigger summary
                performSummarization(false);
            }
        }
    }

    function cleanUrl(url) {
        try {
            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.search);
            const keysToDelete = [];

            // Common tracking parameters to remove
            const trackingParams = [
                '_bhlid',  // Beehiiv
                'fbclid',  // Facebook
                'gclid',   // Google Ads
                'msclkid', // Microsoft Ads
                'dclid',   // DoubleClick
                'mc_eid',  // Mailchimp
                'mc_cid',  // Mailchimp
                'yclid',   // Yandex
                '_hsenc',  // HubSpot
                '_hsmi'    // HubSpot
            ];

            for (const key of params.keys()) {
                if (key.startsWith('utm_') || trackingParams.includes(key)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => params.delete(key));
            urlObj.search = params.toString();
            return urlObj.toString();
        } catch (e) {
            return url;
        }
    }

    const abortBtn = document.getElementById('abortBtn');

    abortBtn.addEventListener('click', () => {
        if (abortController) {
            abortController.abort();
            hideLoading();
            // Optionally show a message
            // showError("Summarization aborted.");
        }
    });

    async function summarizeWithOpenAI(apiKey, text, signal) {
        const prompt = `${SUMMARY_PROMPT}${text.substring(0, 15000)}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                response_format: { type: "json_object" }
            }),
            signal: signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Unknown error from OpenAI');
        }

        const data = await response.json();
        try {
            return JSON.parse(data.choices[0].message.content);
        } catch (e) {
            throw new Error("Failed to parse OpenAI response as JSON");
        }
    }
});
