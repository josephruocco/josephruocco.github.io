// _scripts/gen-repo-list.mjs
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";

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

// Optional site-specific description overrides.
// If a slug is not listed here, the script falls back to the GitHub repo description.
const PROJECT_DESCRIPTIONS = {
  "blackout-poem-extension":
    "Makes blackout poems from the text on your screen, with better results from visible-text filtering and cleaner poem selection.",
  "screen-gloss":
    "A reading overlay that adds instant definitions, references, and annotations on top of text you’re reading.",
  "summa":
    "A reading overlay that adds instant definitions, references, and annotations on top of text you’re reading.",
};

// Optional project-specific links shown alongside Repo/Updates.
// If not provided, we fall back to GitHub's "homepage" field when available.
const PROJECT_LINK_OVERRIDES = {
  "goal-reader": [
    {
      label: "Chrome Dev Console",
      href: "https://chrome.google.com/webstore/devconsole/e4f904b5-3b1e-4e7c-8615-7bb69b10e34e/mchomnhnininjcncokmapokihmkmeeii/edit",
    },
  ],
  bookshelf: [
    { label: "Site", href: "https://bookshelf.josephruocco.net/" },
  ],
  summa: [
    { label: "Demo", href: "https://summa-demo.josephruocco.net/" },
  ],
};

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function loadYamlConfig(path) {
  try {
    const raw = execFileSync(
      "ruby",
      [
        "-ryaml",
        "-rjson",
        "-e",
        "data = YAML.safe_load(File.read(ARGV[0]), permitted_classes: [], aliases: false) || {}; puts JSON.generate(data)",
        path,
      ],
      { encoding: "utf8" }
    );
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizeLinkList(links) {
  if (!Array.isArray(links)) return [];
  return links
    .filter((link) => link && typeof link === "object")
    .map((link) => ({
      label: String(link.label || "").trim(),
      href: String(link.href || "").trim(),
    }))
    .filter((link) => link.label && isValidHttpUrl(link.href));
}

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
  const projectsConfigPath = process.env.PROJECTS_CONFIG_PATH || "_data/projects.yml";
  const projectConfig = loadYamlConfig(projectsConfigPath);
  const projectsBySlug = projectConfig && typeof projectConfig === "object" && projectConfig.projects
    ? projectConfig.projects
    : {};

  // pushed_at = actual code pushes; updated_at = any repo activity
  const sortKey = process.env.REPO_SORT_KEY || "pushed_at";
  const limit = Number(process.env.REPO_LIMIT || 7);
  const maxAgeDays = Number(process.env.REPO_MAX_AGE_DAYS || 30);

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

  // Optionally filter to repos pushed within the last N days.
  if (maxAgeDays > 0) {
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    repos = repos.filter((r) => {
      if (!r.pushed_at) return false;
      const pushedAt = new Date(r.pushed_at).getTime();
      if (Number.isNaN(pushedAt)) return false;
      return (now - pushedAt) <= maxAgeMs;
    });
  }

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
    const normalizedSlug = slug.toLowerCase();
    const cfg = projectsBySlug[slug] && typeof projectsBySlug[slug] === "object"
      ? projectsBySlug[slug]
      : (projectsBySlug[normalizedSlug] && typeof projectsBySlug[normalizedSlug] === "object"
        ? projectsBySlug[normalizedSlug]
        : {});
    const configuredTitle = String(cfg.title || "").trim();
    const label = configuredTitle || applyOverrides(toTitleCaseFromSlug(slug));

    const configuredDescription = String(cfg.description || "").trim();
    const siteDescription = configuredDescription || PROJECT_DESCRIPTIONS[slug] || PROJECT_DESCRIPTIONS[normalizedSlug] || r.description;
    const thumbnailSrc = String(cfg.thumbnail || "").trim();
    const thumbnailAlt = String(cfg.thumbnail_alt || cfg.thumbnailAlt || `${label} screenshot`).trim();

    const descLine = siteDescription
      ? `<div class="project-desc-line">${escapeHtml(siteDescription)}</div>`
      : "";

    const updatesUrl = PROJECT_UPDATES[slug] || PROJECT_UPDATES[normalizedSlug];
    const updatesLink = updatesUrl
      ? `<a class="project-meta-link" href="${updatesUrl}">Updates</a>`
      : "";

    const repoLink = `<a class="project-meta-link" href="${r.html_url}" target="_blank" rel="noopener">Repo</a>`;

    const configuredLinks = normalizeLinkList(cfg.links);
    const explicitLinks = configuredLinks.length > 0
      ? configuredLinks
      : (PROJECT_LINK_OVERRIDES[slug] || PROJECT_LINK_OVERRIDES[normalizedSlug] || []);
    const homepage = String(r.homepage || "").trim();

    const homepageLink = explicitLinks.length === 0 && isValidHttpUrl(homepage)
      ? [{ label: "Site", href: homepage }]
      : [];

    const extraLinks = [...explicitLinks, ...homepageLink]
      .filter((link) => link && link.label && isValidHttpUrl(link.href))
      .map((link) =>
        `<a class="project-meta-link" href="${escapeHtml(link.href)}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>`
      );

    const metaHtml = [repoLink, ...extraLinks, updatesLink].filter(Boolean).join(" · ");

    const thumbnailHtml = thumbnailSrc
      ? `<div class="project-thumb-wrap">
        <img class="project-thumb" src="${escapeHtml(thumbnailSrc)}" alt="${escapeHtml(thumbnailAlt)}" loading="lazy" decoding="async">
      </div>`
      : "";

    return `<li class="project-item">
      ${thumbnailHtml}
      <div class="project-copy">
        <div class="project-title">
          ${escapeHtml(label)}
        </div>
        ${descLine}
        <div class="project-meta">
          ${metaHtml}
        </div>
      </div>
    </li>`;
  });

  const html = `<ul class="projects-list">\n${items.join("\n")}\n</ul>\n`;

  await fs.mkdir("_includes", { recursive: true });
  await fs.writeFile(outputPath, html, "utf8");

  const ageLabel = maxAgeDays > 0 ? `<=${maxAgeDays} days` : "all ages";
  console.log(`Wrote ${outputPath}: ${repos.length} repo(s) (${ageLabel}), top ${limit} by ${sortKey}`);
})().catch((e) => {
  console.error(e.stack || String(e));
  process.exit(1);
});
