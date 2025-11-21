const SUMMARY_PROMPT = `
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
`;
