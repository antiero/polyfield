## Polyfield is a 'Music Mouse' inspired polyphonic MPE Touch field

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to GitHub Pages

Polyfield is configured for static output via SvelteKit `adapter-static`.

### Required build-time base path

For project pages (`https://<user>.github.io/<repo>/`) set:

- `BASE_PATH=/<repo-name>`

For user/org root pages (`https://<user>.github.io/`) set:

- `BASE_PATH=/` (or unset)

### Example (project pages)

```bash
BASE_PATH=/polyfield npm run build
```

Then publish the generated `dist/` directory.

### Notes

- `trailingSlash: 'always'` is enabled for static hosting reliability.
- Static fallback `404.html` is generated for route fallback behavior.
- `static/.nojekyll` is included so GitHub Pages does not run Jekyll processing.


### GitHub Actions

A ready workflow is included at `.github/workflows/deploy.yml` and will:
- build on pushes to `main` (and manual dispatch),
- auto-compute `BASE_PATH` for project vs user/org pages,
- publish `dist/` with `actions/deploy-pages`.
