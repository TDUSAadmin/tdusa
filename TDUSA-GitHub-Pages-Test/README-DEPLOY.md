# TDUSA website — GitHub Pages and Supabase test

This package is for the **test** website. The static website does not require Netlify or Netlify Functions. GitHub Pages is only one possible static host; you can use another static host as well. The existing Supabase **test project** provides admin, results, updates, photo proxy and the Gemini assistant. The existing Netlify site is not removed or changed.

## Folders

- `website/`: static files to put in the GitHub Pages publishing root. It contains no Gemini key, student CSV, database backup, service role key, or backend function source.
- `support/backend/tdusa-assistant.js`: server-side function source for maintainers. It is already deployed to the test Supabase project; do not put a Gemini key in this file.
- `support/knowledge/`: public-site-based JSON knowledge records; unverified 1994 and quiz details are labelled pending verification and omitted from generated model context.
- `support/scripts/build-supabase-assistant-knowledge.py`: regenerates the verified knowledge embedded into the function. After review, changing these files requires redeploying the Supabase function. Published event/announcement and committee updates are loaded from the test project at request time.

## Publish a test site on GitHub Pages

1. Create a GitHub account/repository if you do not already have one. GitHub Pages may require a public repository depending on your plan. Anything placed in the website folder is public. Never put result CSVs, keys, passwords or private documents in it.
2. Extract the ZIP. Add the **contents of `website/`** to the publishing root of the repository, preserving folders. `index.html` must appear at the publishing root, not inside an extra `website` folder. GitHub's browser interface supports at most 100 files per upload; this site has over 250 files, so use multiple batches or Git on a computer. Do not upload the ZIP itself as the website.
3. In the repository open **Settings → Pages**, select **Deploy from a branch**, choose your branch and **/(root)**, and save. Wait for GitHub to show the Pages URL. See https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site and https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository .
4. Open the test URL and check the home page, animations, poster order, `results-test.html`, admin login and photo galleries. A custom domain needs separate DNS/domain verification and HTTPS; this package does not change your domain.
5. GitHub Pages does not process Netlify `_redirects`; direct HTML links are used, and small fallback pages forward `results.html` and `results/` to `results-test.html` on the test site. Do not assume unrelated historical URLs will redirect automatically.

## Assistant setup

The Supabase test project already has the `tdusa-assistant` Edge Function and daily quota. Until you add your own Gemini key it returns a not-configured message. Obtain your key through Google AI Studio; in **Supabase → tdusa-test → Edge Functions → Secrets** add `GEMINI_API_KEY` privately. This is the Supabase secret, not Netlify. Never share it in chat, GitHub or the website. See https://supabase.com/docs/guides/functions/secrets . Review Google pricing, data processing and billing limits.

The assistant uses public facts, up to 24 published updates and a published committee term. No student results or draft updates are included. Chat messages are sent to Google Gemini, and the interface warns visitors not to share sensitive details. The app does not intentionally save chat text; platform and provider logging/retention policies still apply. The test limit is 50 calls per UTC day globally, with a best-effort per-client limit. A public endpoint can be abused or have its quota exhausted, and these limits do not guarantee a maximum bill. Add ingress protection, monitoring, privacy/security review and live-model safety tests before a public launch.

Local tests used mocked Gemini and fictional results, and simulated mobile/tablet/desktop sizes. The real Gemini call, actual GitHub Pages deployment, physical Android tests, and hosted administrator uploads still need testing. Knowledge source links to the previous public site are historical citations, not an operational dependency; verify the official domain and update links when the site moves. Six existing test exams use index-only access, which is not private against anyone who knows or guesses an index.
