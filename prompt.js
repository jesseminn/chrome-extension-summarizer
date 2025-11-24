function getSummaryPrompt(existingTags = []) {
  const tagsList = existingTags.length > 0 ? existingTags.join(', ') : 'none';

  return `
Please summarize this article. Return the response in JSON format.

CRITICAL INSTRUCTION:
- First, detect the language of the provided article content.
- If the detected language is English, the summary and takeaways MUST be in English.
- If the detected language is Traditional Chinese (繁體中文), the summary and takeaways MUST be in Taiwanese Traditional Chinese (台灣正體中文).
- For any other language, the summary and takeaways MUST be in the SAME language as the article.
- Do NOT translate the content to a different language (except for the specific Traditional Chinese handling mentioned above).

- Analyze the content. If it falls into any of the following categories, set "code" to the corresponding value and provide a specific "message" describing exactly why the error happened (e.g., "This is a login page", "Content is too short", "Browser security check detected").
- Otherwise, set "code" to 0.

- Tags: Analyze the MAIN CONTENT of the article (ignore navigation, footers, login prompts, and sidebars).
  1. Identify the PRIMARY THEME (e.g., "job seeking", "react", "travel").
  2. PRIORITIZE using tags from the "Existing Tags" list if they match the primary theme.
  3. Do NOT use tags based on minor details or website infrastructure (e.g., avoid "sso", "security", "login", "privacy policy" unless the article is specifically ABOUT those topics).
  4. Tags MUST be lowercase, extremely concise (1-2 words).
  5. Return 1 to 3 tags. Do not force 3 tags if 1 or 2 are sufficient.
- Existing Tags: ${tagsList}

Response Codes:
- 0: Success
- 101: Unsummarizeable content (Login page / Authentication required / Private content / Browser error / Insufficient content)
- -1: Unknown error

Structure:
{
  "code": integer, // 0 for success, 101 for unsummarizeable, -1 for unknown
  "message": "<string, optional, specific error message if code is not 0>",
  "tags": ["<tag1>", "<tag2>", ...], // Array of strings, 1-3 tags
  "summary": "<markdown string, not array. use \\n for line breaks. around 100 words>",
  "takeaways": "<markdown string, not array. use \\n for line breaks. 5-10 bullet points>",
  "quotes": ["<markdown quote 1>", "... (1-3 quotes)"]
}

Article Content:
`;
}
