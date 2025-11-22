# Summarizer Chrome Extension

**Summarizer** is a powerful Chrome extension that automatically generates concise summaries and key takeaways for any web page you visit. It leverages **Jina.ai** for content extraction and **OpenAI** for intelligent summarization, ensuring you get the gist of any article in seconds.

## Features

- **🚀 Auto-Summarization**: Automatically summarizes the current page when you open the extension popup.
- **🧠 Intelligent Summarization**: Uses OpenAI's GPT models to provide a structured summary and key takeaways.
- **🌍 Multilingual Support**: Automatically detects the language of the article and generates the summary in the same language (supports Traditional Chinese for Taiwan).
- **⚡ Smart Caching**: Caches summaries locally to avoid redundant API calls. Smartly handles URLs by removing tracking parameters (e.g., `utm_`, `fbclid`, `gclid`) to ensure consistent caching across different links to the same content.
- **📋 Rich Text Copy**: Copy the summary with a single click. Preserves formatting (bold, lists, headers) for rich text editors (Google Docs, Email) and provides Markdown for code editors.
- **🎨 Clean UI**: A user-friendly interface with clear loading states, error handling, and a polished design.

## Installation

### From Source

1.  Clone this repository:
    ```bash
    git clone https://github.com/jesseminn/chrome-extension-summarizer.git
    ```
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the directory where you cloned the repository.

## Configuration

Before using the extension, you need to configure your OpenAI API key:

1.  Click on the **Summarizer** extension icon in your browser toolbar.
2.  Enter your **OpenAI API Key** in the input field.
3.  Click **Save Key**.

*Note: Your API key is stored securely in your browser's local storage.*

## Usage

1.  Navigate to any article or web page you want to summarize.
2.  Click the **Summarizer** extension icon.
3.  The extension will automatically fetch the content and display:
    *   **Summary**: A concise overview of the content.
    *   **Key Takeaways**: Bullet points highlighting the most important information.
4.  **Copy**: Click the **📋 Copy** button to copy the summary and takeaways to your clipboard.
5.  **Refresh**: Click **🔄 Summarize Again** to force a fresh summary.

## Development

### Project Structure

*   `manifest.json`: Chrome extension manifest configuration.
*   `popup.html`: The HTML structure of the extension popup.
*   `popup.css`: Styles for the popup interface.
*   `popup.js`: Main logic for the extension (UI handling, caching, API calls).
*   `prompt.js`: Defines the prompt structure sent to OpenAI.
*   `marked.min.js`: Library for rendering Markdown.

### Local Setup

1.  Make changes to the code.
2.  Go to `chrome://extensions/`.
3.  Find **Summarizer** and click the **Reload** icon (circular arrow).
4.  Open the extension popup to test your changes.

## License

[MIT](LICENSE)
