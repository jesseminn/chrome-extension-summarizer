const SUMMARY_PROMPT = `
Please summarize this article. Return the response in JSON format.

IMPORTANT: 
- Detect the language of the article content.
- Return the summary in the SAME language as the article.
- If the article is in Traditional Chinese (繁體中文), use Taiwanese Traditional Chinese (台灣正體中文) for the summary.

Structure:
{
  "summary": "<markdown string, around 100 words>",
  "takeaways": "<markdown string, 5-10 bullet points>"
}

Article Content:
`;
