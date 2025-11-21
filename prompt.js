const SUMMARY_PROMPT = `
Please summarize this article. Return the response in HTML format (no markdown code blocks, just raw HTML tags).

IMPORTANT: 
- Detect the language of the article content.
- Return the summary in the SAME language as the article.
- If the article is in Traditional Chinese (繁體中文), use Taiwanese Traditional Chinese (台灣正體中文) for the summary.

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
`;
