require("dotenv").config();

const { WakaTimeClient, RANGE } = require("wakatime-client");
const Octokit = require("@octokit/rest");

const {
  GIST_ID: gistId,
  GH_TOKEN: githubToken,
  WAKATIME_API_KEY: wakatimeApiKey
} = process.env;

const wakatime = new WakaTimeClient(wakatimeApiKey);

const octokit = new Octokit({ auth: `token ${githubToken}` });

async function main() {
  const stats = await wakatime.getMyStats({ range: RANGE.LAST_7_DAYS });
  const lines = getLines(stats);
  console.log(lines);
  await updateGist(lines.join("\n"));
  // await addCommentToGithubPage(lines);
}

function getLines(stats) {
  const lines = [];
  for (let i = 0; i < Math.min(stats.data.languages.length, 5); i++) {
    const data = stats.data.languages[i];
    const { name, percent, text: time } = data;

    const line = [
      name.length > 14 ? `${name.substring(0, 8)}...` : name.padEnd(11),
      time
        .replace(/hrs?/g, "h")
        .replace(/mins?/g, "m")
        .padEnd(9),
      generateBarChart(percent, 21),
      String(percent.toFixed(1)).padStart(5) + "%"
    ];

    lines.push(line.join(" "));
  }
  return lines;
}

async function updateGist(lines) {
  if (lines.length == 0) return;
  let gist;
  try {
    gist = await octokit.gists.get({ gist_id: gistId });
  } catch (error) {
    console.error(`Unable to get gist\n${error}`);
  }

  try {
    // Get original filename to update that same file
    const filename = Object.keys(gist.data.files)[0];
    const content = gist.data.files[filename].content;
    if (lines == content) return;
    await octokit.gists.update({
      gist_id: gistId,
      files: {
        [filename]: {
          filename: filename,
          content: lines
        }
      }
    });
  } catch (error) {
    console.error(`Unable to update gist\n${error}`);
  }
}

async function addCommentToGithubPage(lines) {
  try {
    const formatLines = ["```markdown", ...lines, "```"].join("\n");
    const response = await octokit.issues.createComment({
      owner: "shinelikeamillion",
      repo: "shinelikeamillion.github.io",
      issue_number: "6",
      body: formatLines
    });

    // const response = await octokit.request(
    //   "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
    //   {
    //     owner: "shinelikeamillion",
    //     repo: "shinelikeamillion.github.io",
    //     issue_number: "6",
    //     body: formatLines,
    //     headers: {
    //       "X-GitHub-Api-Version": "2022-11-28"
    //     }
    //   }
    // );
    console.log("octokit: ", response);
  } catch (error) {
    console.error(`Can not add a comment\n${error}`);
  }
}

function generateBarChart(percent, size) {
  const syms = "░▏▎▍▌▋▊▉█";

  const frac = Math.floor((size * 8 * percent) / 100);
  const barsFull = Math.floor(frac / 8);
  if (barsFull >= size) {
    return syms.substring(8, 9).repeat(size);
  }
  const semi = frac % 8;

  const result = [
    syms.substring(8, 9).repeat(barsFull),
    syms.substring(semi, semi + 1)
  ]
    .join("")
    .padEnd(size, syms.substring(0, 1));

  return result;
}

(async () => {
  await main();
})();
