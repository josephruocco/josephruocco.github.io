// _scripts/gen-repo-list.mjs
import fs from "node:fs/promises";

function fmtDate(iso) {
  if (!iso) return "n/a";
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function toTitleCaseFromSlug(slug) {
  // slug: "mood-orb-extension" -> "Mood Orb Extension"
  return String(slug ?? "")
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function applyOverrides(title) {
  // Upgrade common acronyms/words
  return title
    .replace(/\bNyc\b/g, "NYC")
    .replace(/\bIpums\b/g, "IPUMS")
    .replace(/\bCpp\b/g, "C++")
    .replace(/\bIrd\b/g, "IRD")
    .replace(/\bApi\b/g, "API");
}

// Map repo slugs to internal Jekyll project update pages.
// Only repos listed here will show an "Updates" link.
const PROJECT_UPDATES = {
  "blackout-poem-extension": "/projects/blackout-poem-extension/",
  "mutual-vanish": "/projects/mutual-vanish/",
  "nyc-street-history": "/projects/nyc-street-history/",
  "mood-orb-extension": "/projects/mood-orb-extension/",
  "heston-streamlit": "/projects/heston-streamlit/",
};

async function ghFetch(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "netlify-repo-tracker",
  };

  // Token is optional (public repos work without it); it improves rate limits.
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} for ${url}\n${txt}`);
  }
  return res.json();
}

async function fetchAllUserRepos(username) {
  const out = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=updated`;
    const batch = await ghFetch(url);
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return out;
}

(async () => {
  const inputPath = process.argv[2] || "_data/repos.txt";
  const outputPath = process.argv[3] || "_includes/repo_list.html";

  // pushed_at = actual code pushes; updated_at = any repo activity
  const sortKey = process.env.REPO_SORT_KEY || "pushed_at";
  const limit = Number(process.env.REPO_LIMIT || 7);

  // Safety: never output private repos on a public site
  const includeForks = (process.env.INCLUDE_FORKS || "false") === "true";
  const includeArchived = (process.env.INCLUDE_ARCHIVED || "false") === "true";

  const raw = await fs.readFile(inputPath, "utf8");
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  // Expect a line like "@username"
  const at = lines.find((l) => l.startsWith("@"));
  if (!at) {
    throw new Error(`Expected a line like "@username" in ${inputPath}`);
  }
  const username = at.slice(1);

  let repos = await fetchAllUserRepos(username);

  repos = repos.filter((r) => {
    // HARD LOCK: never leak private repo names
    if (r.private) return false;

    // Exclude forks/archived unless explicitly enabled
    if (!includeForks && r.fork) return false;
    if (!includeArchived && r.archived) return false;

    // Exclude your website repo
    if (r.full_name === "josephruocco/josephruocco.github.io") return false;

    return true;
  });

  // Sort + take top N
  repos.sort((a, b) => new Date(b[sortKey]) - new Date(a[sortKey]));
  repos = repos.slice(0, limit);

  const items = repos.map((r) => {
    // Kept in case you want to surface metadata later
    const upd = fmtDate(r.updated_at);
    const push = fmtDate(r.pushed_at);
    const stars = r.stargazers_count ?? 0;
    void upd; void push; void stars;

    const slug = r.full_name.replace(/^josephruocco\//, "");
    const label = applyOverrides(toTitleCaseFromSlug(slug));

    const descLine = r.description
      ? `<div class="project-desc-line" style="margin-top:0.2rem; color:#555;">${escapeHtml(r.description)}</div>`
      : "";

    const updatesUrl = PROJECT_UPDATES[slug];
    const updatesLink = updatesUrl
      ? `<a class="project-meta-link" href="${updatesUrl}">Updates</a>`
      : "";

    const repoLink = `<a class="project-meta-link" href="${r.html_url}" target="_blank" rel="noopener">Repo</a>`;

    const metaLinks = updatesLink ? `${repoLink} · ${updatesLink}` : repoLink;

    return `<li class="project-item" style="margin-bottom: 1.5rem;">
      <div class="project-title" style="font-size: 1.1rem; font-weight: 600;">
        ${escapeHtml(label)}
      </div>
      ${descLine}
      <div class="project-meta" style="margin-top:0.35rem; font-size:0.95rem; color:#666;">
        ${metaLinks}
      </div>
    </li>`;
  });

  const html = `<ul class="projects-list">\n${items.join("\n")}\n</ul>\n`;

  await fs.mkdir("_includes", { recursive: true });
  await fs.writeFile(outputPath, html, "utf8");

  console.log(`Wrote ${outputPath}: top ${repos.length} by ${sortKey}`);
})().catch((e) => {
  console.error(e.stack || String(e));
  process.exit(1);
});
