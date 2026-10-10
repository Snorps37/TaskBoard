# Schoology on the web version

The desktop app reads your Schoology calendar link directly. A website can't: browsers block it. There are two ways around that in the web version.

## Option 1: import the calendar file (no setup)

In Schoology's calendar sharing settings, click **Download**. In TaskBoard open Settings, then Schoology, and choose that file under "Or import the downloaded calendar file". Repeat it whenever you want fresh assignments. It's the same import as the desktop app, so your own edits are never overwritten.

## Option 2: a small proxy, for automatic syncing

A proxy is a tiny program that fetches the link for the browser. Cloudflare Workers can run one for free.

1. Make a free account at cloudflare.com and open **Workers & Pages**.
2. Create a new Worker (any name), deploy it, then choose **Edit code**.
3. Replace everything with the contents of `docs/schoology-proxy.js` from this repository, and deploy.
4. Copy the worker's address (it looks like `https://name.yourname.workers.dev`).
5. In TaskBoard open Settings, then Schoology, paste that address into **Proxy address**, paste your calendar link above it, and click **Connect and sync**.

Notes:

- The worker only forwards `*.schoology.com` calendar links, and only for the sites listed at the top of the file. If you host TaskBoard somewhere else, add that address to `ALLOWED_ORIGINS`.
- Your calendar link passes through the worker you set up, so use your own rather than someone else's.
- If your school uses its own address for Schoology (not `*.schoology.com`), change the host check in the worker.
