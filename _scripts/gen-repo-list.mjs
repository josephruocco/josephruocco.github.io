import fs from "node:fs/promises";

function fmtDate(iso) {
  if (!iso) return "n/a";
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function ghFetch(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "netlify-repo-tracker",
  };
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

  // per_page max is 100
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

const inputPath = process.argv[2] || "_data/repos.txt";
const outputPath = process.argv[3] || "_includes/repo_list.md";

// pushed_at = actual code pushes; updated_at = any repo activity
const sortKey = process.env.REPO_SORT_KEY || "pushed_at";
const limit = Number(process.env.REPO_LIMIT || 5);

const raw = await fs.readFile(inputPath, "utf8");
const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

// Expect first meaningful line like "@username"
const at = lines.find((l) => l.startsWith("@"));
if (!at) {
  throw new Error(`Expected a line like "@username" in ${inputPath}`);
}
const username = at.slice(1);

// Fetch, filter
let repos = await fetchAllUserRepos(username);

// keep only public, non-fork, non-archived by default
const includeForks = (process.env.INCLUDE_FORKS || "false") === "true";
const includeArchived = (process.env.INCLUDE_ARCHIVED || "false") === "true";
const visibility = process.env.VISIBILITY || "public"; // public|all

repos = repos.filter((r) => {
  if (visibility === "public" && r.private) return false;
  if (!includeForks && r.fork) return false;
  if (!includeArchived && r.archived) return false;
  return true;
});

// Sort + take top N
repos.sort((a, b) => new Date(b[sortKey]) - new Date(a[sortKey]));
repos = repos.slice(0, limit);

// Render markdown
const linesOut = repos.map((r) => {
  const upd = fmtDate(r.updated_at);
  const push = fmtDate(r.pushed_at);
  const desc = r.description ? ` — ${r.description}` : "";
  return `- [${r.full_name}](${r.html_url}) (pushed ${push}, updated ${upd}, ⭐ ${r.stargazers_count ?? 0})${desc}`;
});

await fs.mkdir("_includes", { recursive: true });
await fs.writeFile(outputPath, linesOut.join("\n") + "\n", "utf8");

console.log(`Wrote ${outputPath}: top ${repos.length} by ${sortKey}`);
