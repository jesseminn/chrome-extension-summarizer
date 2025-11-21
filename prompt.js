const SUMMARY_PROMPT = `
Please summarize this article. Return the response in JSON format.

CRITICAL INSTRUCTION:
- You MUST detect the language of the article content.
- You MUST return the summary and takeaways in the STRICTLY SAME language as the article.
- Do NOT translate to English unless the article is in English.
- If the article is in Traditional Chinese (繁體中文), use Taiwanese Traditional Chinese (台灣正體中文).

Structure:
{
  "summary": "<markdown string, not array. use \\n for line breaks. around 100 words>",
  "takeaways": "<markdown string, not array. use \\n for line breaks. 5-10 bullet points>"
}

Article Content:
`;
