document.addEventListener('DOMContentLoaded', () => {
    const settingsSection = document.getElementById('settingsSection');
    const mainSection = document.getElementById('mainSection');

    const apiKeyInput = document.getElementById('apiKey');
    const githubTokenInput = document.getElementById('githubToken');
    const gistIdInput = document.getElementById('gistId');

    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const backSettingsBtn = document.getElementById('backSettingsBtn');
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    const openSettingsBtn = document.getElementById('openSettingsBtn');

    let originalConfig = { apiKey: '', token: '', gistId: '' };
    let allTags = [];

    const summarizeBtn = document.getElementById('summarizeBtn');
    const summarizeAgainBtn = document.getElementById('summarizeAgainBtn');
    const copyBtn = document.getElementById('copyBtn');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');
    const summaryBody = document.getElementById('summaryBody');
    const takeawaysBody = document.getElementById('takeawaysBody');
    const errorDiv = document.getElementById('error');
    const loadingText = document.getElementById('loadingText');

    // Check for all required keys
    // Check for all required keys
    chrome.storage.local.get(['openaiApiKey', 'githubToken', 'gistId', 'allTags'], (result) => {
        if (result.allTags) {
            allTags = result.allTags;
        }

        if (result.openaiApiKey && result.githubToken && result.gistId) {
            showMainSection();
            checkCache();
            // Sync tags on load
            syncTagsWithGist(result.githubToken, result.gistId).catch(err => console.error('Tag sync failed:', err));
        } else {
            showSettings();
        }
    });

    // Input validation and Draft Saving
    function handleInput() {
        const apiKey = apiKeyInput.value.trim();
        const token = githubTokenInput.value.trim();
        const gistId = gistIdInput.value.trim();

        // Save drafts
        chrome.storage.local.set({
            draft_openaiApiKey: apiKey,
            draft_githubToken: token,
            draft_gistId: gistId
        });

        const isValid = apiKey && token && gistId;
        const isDirty = apiKey !== originalConfig.apiKey ||
            token !== originalConfig.token ||
            gistId !== originalConfig.gistId;

        const hasValidStoredConfig = originalConfig.apiKey && originalConfig.token && originalConfig.gistId;

        // Back Button: Hidden if we don't have a valid stored config (onboarding)
        if (hasValidStoredConfig) {
            backSettingsBtn.classList.remove('hidden');
        } else {
            backSettingsBtn.classList.add('hidden');
        }

        // Save Button: Disabled if inputs invalid OR nothing changed
        if (isValid && isDirty) {
            saveSettingsBtn.disabled = false;
        } else {
            saveSettingsBtn.disabled = true;
        }

        // Ensure Save button is visible
        saveSettingsBtn.classList.remove('hidden');

        if (token && gistId) {
            clearCacheBtn.classList.remove('hidden');
        } else {
            clearCacheBtn.classList.add('hidden');
        }
    }

    apiKeyInput.addEventListener('input', handleInput);
    githubTokenInput.addEventListener('input', handleInput);
    gistIdInput.addEventListener('input', handleInput);

    openSettingsBtn.addEventListener('click', () => {
        showSettings();
    });

    backSettingsBtn.addEventListener('click', async () => {
        // Clear drafts so next time we open settings, we see saved config
        await chrome.storage.local.remove(['draft_openaiApiKey', 'draft_githubToken', 'draft_gistId']);
        showMainSection();
    });

    async function validateOpenAIKey(apiKey) {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    async function validateGitHubGist(token, gistId) {
        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    saveSettingsBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const token = githubTokenInput.value.trim();
        const gistId = gistIdInput.value.trim();

        if (!apiKey || !token || !gistId) {
            showError("All fields are required.");
            return;
        }

        saveSettingsBtn.disabled = true;
        saveSettingsBtn.textContent = "Validating...";
        hideError();

        try {
            // Validate OpenAI Key
            const isApiKeyValid = await validateOpenAIKey(apiKey);
            if (!isApiKeyValid) {
                throw new Error("Invalid OpenAI API Key. Please check your key.");
            }

            // Validate GitHub Token & Gist ID
            const isGistValid = await validateGitHubGist(token, gistId);
            if (!isGistValid) {
                throw new Error("Invalid GitHub Token or Gist ID. Please check permissions and ID.");
            }

            saveSettingsBtn.textContent = "Saving...";

            // Save config
            await chrome.storage.local.set({
                openaiApiKey: apiKey,
                githubToken: token,
                gistId: gistId
            });

            // Clear drafts on successful save
            await chrome.storage.local.remove(['draft_openaiApiKey', 'draft_githubToken', 'draft_gistId']);

            // Sync immediately
            await syncWithGist(token, gistId);
            await syncTagsWithGist(token, gistId);

            saveSettingsBtn.textContent = "✅ Saved!";
            setTimeout(() => {
                showMainSection();
                checkCache();
                saveSettingsBtn.textContent = "Save Settings";
                saveSettingsBtn.disabled = false;
            }, 1500);
        } catch (err) {
            showError(err.message);
            saveSettingsBtn.textContent = "Save Settings";
            saveSettingsBtn.disabled = false;
        }
    });

    clearCacheBtn.addEventListener('click', async () => {
        const token = githubTokenInput.value.trim();
        const gistId = gistIdInput.value.trim();

        if (!token || !gistId) {
            showError("GitHub Token and Gist ID are required to clear remote cache.");
            return;
        }

        if (confirm("Are you sure you want to clear the remote Gist cache and local cache? This cannot be undone.")) {
            clearCacheBtn.disabled = true;
            clearCacheBtn.textContent = "Clearing...";

            try {
                // Clear Gist using input values
                await updateGistContent(token, gistId, {});

                // Clear Local (keep config)
                const config = await chrome.storage.local.get(['openaiApiKey', 'githubToken', 'gistId']);
                await chrome.storage.local.clear();
                await chrome.storage.local.set(config);

                clearCacheBtn.textContent = "✅ Cleared!";
                setTimeout(() => {
                    clearCacheBtn.textContent = "🗑️ Clear Remote Cache";
                    clearCacheBtn.disabled = false;
                }, 1500);
            } catch (err) {
                showError(`Failed to clear cache: ${err.message}`);
                clearCacheBtn.textContent = "🗑️ Clear Remote Cache";
                clearCacheBtn.disabled = false;
            }
        }
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
        const quotes = currentData.quotes;

        // Plain text (Markdown)
        let plainText = `### Summary\n${summaryText}\n\n### Key Takeaways\n${takeawaysText}`;
        if (quotes) {
            let quotesText = '';
            if (Array.isArray(quotes)) {
                quotesText = quotes.map(q => `> ${q}`).join('\n\n');
            } else {
                quotesText = quotes;
            }
            plainText += `\n\n### Quotes\n${quotesText}`;
        }

        // HTML
        let htmlContent = `
            <h3>Summary</h3>
            ${marked.parse(summaryText)}
            <h3>Key Takeaways</h3>
            ${marked.parse(takeawaysText)}
        `;
        if (quotes) {
            let quotesHtml = '';
            if (Array.isArray(quotes)) {
                quotesHtml = quotes.map(q => `<blockquote>${marked.parse(q)}</blockquote>`).join('');
            } else {
                quotesHtml = marked.parse(quotes);
            }
            htmlContent += `
                <h3>Quotes</h3>
                ${quotesHtml}
            `;
        }

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

            if (!isUrlSupported(tab.url)) {
                showUnsupportedUrl('protocol');
                hideLoading();
                return;
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
                    const data = await summarizeWithOpenAI(apiKey, rawText, signal, allTags);

                    if (data.code !== 0) {
                        showUnsupportedUrl('content', data.message);
                        hideLoading();
                        return;
                    }

                    // Handle Tags
                    if (data.tags && Array.isArray(data.tags)) {
                        const newTags = data.tags.filter(t => !allTags.includes(t));
                        if (newTags.length > 0) {
                            allTags = [...allTags, ...newTags].sort();
                            await chrome.storage.local.set({ allTags });

                            // Sync tags to Gist
                            chrome.storage.local.get(['githubToken', 'gistId'], async (res) => {
                                if (res.githubToken && res.gistId) {
                                    syncTagsWithGist(res.githubToken, res.gistId).catch(err => console.error('Tag sync failed:', err));
                                }
                            });
                        }
                    }

                    const timestamp = Date.now();

                    // Cache the result locally
                    chrome.storage.local.set({ [cacheKey]: { data, timestamp } });
                    displaySummary(data, timestamp);

                    // Auto-Sync Cache to Gist
                    chrome.storage.local.get(['githubToken', 'gistId'], async (res) => {
                        if (res.githubToken && res.gistId) {
                            try {
                                await syncWithGist(res.githubToken, res.gistId);
                                console.log('Auto-synced cache to Gist');
                            } catch (syncErr) {
                                console.error('Auto-sync cache failed:', syncErr);
                            }
                        }
                    });

                } catch (err) {
                    if (err.name === 'AbortError') {
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
                hideLoading();
                summarizeBtn.classList.remove('hidden');
            } else {
                showError(err.message);
                hideLoading();
                summarizeBtn.classList.remove('hidden');
            }
        }
    }

    function showSettings() {
        hideError(); // Clear any existing errors
        mainSection.classList.add('hidden');
        settingsSection.classList.remove('hidden');
        openSettingsBtn.classList.add('hidden'); // Hide settings button in settings view

        chrome.storage.local.get([
            'openaiApiKey', 'githubToken', 'gistId',
            'draft_openaiApiKey', 'draft_githubToken', 'draft_gistId'
        ], (result) => {
            // Store original config
            originalConfig = {
                apiKey: result.openaiApiKey || '',
                token: result.githubToken || '',
                gistId: result.gistId || ''
            };

            // Prefer draft, then saved, then empty
            apiKeyInput.value = result.draft_openaiApiKey !== undefined ? result.draft_openaiApiKey : (result.openaiApiKey || '');
            githubTokenInput.value = result.draft_githubToken !== undefined ? result.draft_githubToken : (result.githubToken || '');
            gistIdInput.value = result.draft_gistId !== undefined ? result.draft_gistId : (result.gistId || '');

            handleInput(); // Validate immediately on show
        });
    }

    function showMainSection() {
        hideError(); // Clear any existing errors
        settingsSection.classList.add('hidden');
        mainSection.classList.remove('hidden');
        openSettingsBtn.classList.remove('hidden'); // Show settings button in main view
    }

    function updateLoadingText(text) {
        loadingText.textContent = text;
    }

    function showLoading() {
        loadingDiv.classList.remove('hidden');
        summarizeBtn.disabled = true;
        summarizeAgainBtn.disabled = true;
        copyBtn.disabled = true;
        openSettingsBtn.classList.add('hidden'); // Hide settings button during summary
    }

    function hideLoading() {
        loadingDiv.classList.add('hidden');
        summarizeBtn.disabled = false;
        summarizeAgainBtn.disabled = false;
        copyBtn.disabled = false;
        openSettingsBtn.classList.remove('hidden'); // Show settings button after summary
    }

    function displaySummary(data, timestamp) {
        currentData = data;
        // Parse markdown using marked
        summaryBody.innerHTML = marked.parse(data.summary || '');
        takeawaysBody.innerHTML = marked.parse(data.takeaways || '');

        const tagsBody = document.getElementById('tagsBody');
        if (tagsBody) {
            tagsBody.innerHTML = ''; // Clear existing
            if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
                data.tags.forEach(tag => {
                    const span = document.createElement('span');
                    span.className = 'tag-pill';
                    span.textContent = tag;
                    tagsBody.appendChild(span);
                });
                tagsBody.classList.remove('hidden');
            } else {
                tagsBody.classList.add('hidden');
            }
        }

        const quotesBody = document.getElementById('quotesBody');
        if (quotesBody) {
            if (Array.isArray(data.quotes)) {
                quotesBody.innerHTML = data.quotes.map(quote => `<blockquote>${marked.parse(quote)}</blockquote>`).join('');
            } else {
                quotesBody.innerHTML = marked.parse(data.quotes || '');
            }
        }

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

        if (data.summary || data.takeaways || data.quotes) {
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

    function isUrlSupported(url) {
        try {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol;
            const hostname = urlObj.hostname.toLowerCase();

            // 1. Protocol Check
            if (!['http:', 'https:'].includes(protocol)) {
                return false;
            }

            // 2. Localhost Check
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return false;
            }

            return true;
        } catch (e) {
            return false;
        }
    }

    function showUnsupportedUrl(type, reason) {
        let msg = '';
        if (type === 'protocol') {
            msg = `
                <strong>Page Not Supported</strong><br><br>
                We can only summarize public web pages (http/https).<br>
                Internal browser pages and local files are not supported.
            `;
        } else if (type === 'content') {
            const reasonText = reason || 'The content of this page could not be processed.';
            msg = `
                <strong>Unable to Summarize</strong><br><br>
                ${reasonText}
            `;
        }

        showError(msg);
        errorDiv.innerHTML = msg;
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

    async function summarizeWithOpenAI(apiKey, text, signal, existingTags = []) {
        const prompt = `${getSummaryPrompt(existingTags)}${text.substring(0, 15000)}`;

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

    async function updateGistContent(token, gistId, content) {
        const GIST_FILENAME = 'summarizer_cache.json';
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    [GIST_FILENAME]: {
                        content: JSON.stringify(content)
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update Gist');
        }
    }

    async function syncWithGist(token, gistId) {
        const GIST_FILENAME = 'summarizer_cache.json';
        const headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        // 1. Fetch Gist Data
        const getResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: headers
        });

        if (!getResponse.ok) {
            throw new Error('Failed to fetch Gist');
        }

        const getData = await getResponse.json();
        const file = getData.files[GIST_FILENAME];
        if (!file) {
            throw new Error(`File ${GIST_FILENAME} not found in Gist`);
        }

        let remoteCache = {};
        try {
            remoteCache = JSON.parse(file.content);
        } catch (e) {
            console.error('Failed to parse remote cache', e);
            remoteCache = {};
        }

        // 3. Get Local Data
        const localData = await new Promise(resolve => {
            chrome.storage.local.get(null, (items) => {
                resolve(items);
            });
        });

        // 4. Merge Data
        const mergedCache = { ...remoteCache };

        // Merge local into remote (and track updates for local)
        for (const [key, value] of Object.entries(localData)) {
            if (key.startsWith('summary_')) {
                if (!mergedCache[key] || (value.timestamp > mergedCache[key].timestamp)) {
                    mergedCache[key] = value;
                }
            }
        }

        // 5. Update Gist
        const updateResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify({
                files: {
                    [GIST_FILENAME]: {
                        content: JSON.stringify(mergedCache)
                    }
                }
            })
        });

        if (!updateResponse.ok) {
            throw new Error('Failed to update Gist');
        }

        // 6. Update Local Storage
        await chrome.storage.local.set(mergedCache);
    }
    async function syncTagsWithGist(token, gistId) {
        const TAGS_FILENAME = 'summarizer_tags.json';
        const headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        try {
            // 1. Fetch Gist Data
            const getResponse = await fetch(`https://api.github.com/gists/${gistId}`, { headers });
            if (!getResponse.ok) throw new Error('Failed to fetch Gist for tags');

            const getData = await getResponse.json();
            const file = getData.files[TAGS_FILENAME];

            let remoteTags = [];
            if (file) {
                try {
                    remoteTags = JSON.parse(file.content).tags || [];
                } catch (e) {
                    console.error('Failed to parse remote tags', e);
                }
            }

            // 2. Merge Tags (Union of local and remote)
            const mergedTags = [...new Set([...allTags, ...remoteTags])].sort();

            // Update local state if changed
            if (mergedTags.length !== allTags.length) {
                allTags = mergedTags;
                await chrome.storage.local.set({ allTags: mergedTags });
            }

            // 3. Update Gist if remote is different (or if file didn't exist)
            const remoteTagsSet = new Set(remoteTags);
            const isDifferent = mergedTags.length !== remoteTags.length || !mergedTags.every(t => remoteTagsSet.has(t));

            if (isDifferent || !file) {
                await fetch(`https://api.github.com/gists/${gistId}`, {
                    method: 'PATCH',
                    headers: headers,
                    body: JSON.stringify({
                        files: {
                            [TAGS_FILENAME]: {
                                content: JSON.stringify({ tags: mergedTags })
                            }
                        }
                    })
                });
            }
        } catch (err) {
            console.error('Sync tags error:', err);
        }
    }
});
