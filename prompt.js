const SUMMARY_PROMPT = `
Please summarize this article. Return the response in JSON format.

CRITICAL INSTRUCTION:
- First, detect the language of the provided article content.
- If the detected language is English, the summary and takeaways MUST be in English.
- If the detected language is Traditional Chinese (繁體中文), the summary and takeaways MUST be in Taiwanese Traditional Chinese (台灣正體中文).
- For any other language, the summary and takeaways MUST be in the SAME language as the article.
- Do NOT translate the content to a different language (except for the specific Traditional Chinese handling mentioned above).

Structure:
{
  "summary": "<markdown string, not array. use \\n for line breaks. around 100 words>",
  "takeaways": "<markdown string, not array. use \\n for line breaks. 5-10 bullet points>",
  "quotes": ["<markdown quote 1>", "... (1-3 quotes)"]
}

Article Content:
`;
