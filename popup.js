document.addEventListener('DOMContentLoaded', () => {
    const apiKeySection = document.getElementById('apiKeySection');
    const mainSection = document.getElementById('mainSection');
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyBtn = document.getElementById('saveKeyBtn');
    const summarizeBtn = document.getElementById('summarizeBtn');
    const summarizeAgainBtn = document.getElementById('summarizeAgainBtn');
    const manageKeyBtn = document.getElementById('manageKeyBtn');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');
    const summaryContent = document.getElementById('summaryContent');
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

    summarizeBtn.addEventListener('click', () => {
        performSummarization(false);
    });

    summarizeAgainBtn.addEventListener('click', () => {
        performSummarization(true);
    });

    async function performSummarization(forceRefresh) {
        hideError();
        showLoading();
        resultDiv.classList.add('hidden');
        summarizeAgainBtn.classList.add('hidden');

        try {
            const tab = await getCurrentTab();
            if (!tab || !tab.url) {
                throw new Error('Cannot get current tab URL.');
            }

            const cacheKey = `summary_${tab.url}`;

            if (!forceRefresh) {
                // Try to get from cache first
                const cached = await getFromCache(cacheKey);
                if (cached && cached.summary) {
                    displaySummary(cached.summary, cached.timestamp);
                    hideLoading();
                    return;
                }
            }

            updateLoadingText("Requiring raw content..."); // Added this line
            const jinaUrl = `https://r.jina.ai/${encodeURIComponent(tab.url)}`;

            // Fetch content from Jina
            const jinaResponse = await fetch(jinaUrl);
            if (!jinaResponse.ok) {
                throw new Error(`Failed to fetch content from Jina.ai: ${jinaResponse.statusText}`);
            }
            const rawText = await jinaResponse.text();

            // Get API Key
            chrome.storage.local.get(['openaiApiKey'], async (result) => {
                const apiKey = result.openaiApiKey;
                if (!apiKey) {
                    showError('API Key not found. Please set it again.');
                    showApiKeySection();
                    return;
                }

                try {
                    updateLoadingText("Requiring summary..."); // Added this line
                    const summary = await summarizeWithOpenAI(apiKey, rawText);
                    const timestamp = Date.now();
                    // Cache the result
                    chrome.storage.local.set({ [cacheKey]: { summary, timestamp } });
                    displaySummary(summary, timestamp);
                } catch (err) {
                    showError(`OpenAI Error: ${err.message}`);
                } finally {
                    hideLoading();
                }
            });

        } catch (err) {
            showError(err.message);
            hideLoading();
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
    }

    function hideLoading() {
        loadingDiv.classList.add('hidden');
        summarizeBtn.disabled = false;
        summarizeAgainBtn.disabled = false;
    }

    function displaySummary(text, timestamp) {
        summaryContent.innerHTML = text;

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
            const cacheKey = `summary_${tab.url}`;
            const cached = await getFromCache(cacheKey);
            if (cached && cached.summary) {
                displaySummary(cached.summary, cached.timestamp);
            } else {
                // Reset UI state if no cache
                summarizeBtn.classList.remove('hidden');
                summarizeAgainBtn.classList.add('hidden');
                resultDiv.classList.add('hidden');
            }
        }
    }

    async function summarizeWithOpenAI(apiKey, text) {
        const prompt = `
Please summarize this article. Return the response in HTML format (no markdown code blocks, just raw HTML tags).

Structure:
<p>[Summary in 100 words]</p>
<hr>
<h3>Key Takeaways:</h3>
<ul>
  <li>[Takeaway 1]</li>
  <li>[Takeaway 2]</li>
  ...
</ul>

Article Content:
${text.substring(0, 15000)} 
`;

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
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Unknown error from OpenAI');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
});
