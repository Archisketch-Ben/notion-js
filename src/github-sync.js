import { Client } from "@notionhq/client";
import "./config/env.js";
import { Octokit } from "octokit";
import _ from "lodash";
import { makeConsoleLogger } from "@notionhq/client/build/src/logging.js";

/**
 * DOM Element
 */
const syncButton = document.getElementById("notion-github-sync-button");

const octokit = new Octokit({ auth: process.env.GITHUB_KEY });
const notion = new Client({ auth: process.env.NOTION_KEY });

const databaseId = process.env.NOTION_DATABASE_ID;
const OPERATION_BATCH_SIZE = 10;

/**
 * 로컬 data store를 초기화합니다.
 * 그런 다음 GitHub와 동기화합니다.
 */
const gitHubIssuesIdToNotionPageId = {};

/**
 * 로컬 data store를 초기화합니다.
 * 그런 다음 GitHub와 동기화합니다.
 */
function startSync() {
  console.log("start");
  setInitialGitHubToNotionIdMap().then(syncNotionDatabaseWithGitHub);
}

/**
 * 현재 데이터베이스에 issue가 있는 초기 data store를 가져오고 설정합니다.
 */
async function setInitialGitHubToNotionIdMap() {
  const currentIssues = await getIssuesFromNotionDatabase();
  for (const { pageId, issueNumber } of currentIssues) {
    gitHubIssuesIdToNotionPageId[issueNumber] = pageId;
  }
}

async function syncNotionDatabaseWithGitHub() {
  // 현재 제공된 GitHub 저장소에 있는 모든 issue를 가져옵니다.
  console.log("\nFetching issues from Notion DB...");
  const issues = await getGitHubIssuesForRepository();
  console.log(`Fetched ${issues.length} issues from GitHub repository.`);

  // Notion 데이터베이스에서 생성하거나 업데이트해야 하는 issue를 그룹화합니다.
  const { pagesToCreate, pagesToUpdate } = getNotionOperations(issues);

  // 새로운 issue에 대한 페이지를 생성합니다.
  console.log(`\n${pagesToCreate.length} new issues to add to Notion.`);
  await createPages(pagesToCreate);

  // 기존 issue에 대한 페이지를 업데이트합니다.
  console.log(`\n${pagesToUpdate.length} issues to update in Notion.`);
  await updatePages(pagesToUpdate);

  // 성공 시 로그
  console.log("\n✅ Notion database is synced with GitHub.");
}

/**
 * Notion 데이터베이스에서 페이지를 가져옵니다.
 *
 * @returns {Promise<Array<{ pageId: string, issueNumber: number }>>}
 */
async function getIssuesFromNotionDatabase() {
  const pages = [];
  let cursor = undefined;
  while (true) {
    const { results, next_cursor } = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
    });
    pages.push(...results);
    if (!next_cursor) {
      break;
    }
    cursor = next_cursor;
  }
  console.log("pages:", pages);
  console.log(`${pages.length} issues successfully fetched.`);
  return pages.map((page) => {
    return {
      pageId: page.id,
      issueNumber: page.properties["Issue Number"].number,
    };
  });
}

/**
 * GitHub 리포지토리에서 issue를 가져옵니다. PR은 생략합니다.
 *
 * https://docs.github.com/en/rest/guides/traversing-with-pagination
 * https://docs.github.com/en/rest/reference/issues
 *
 * @returns {Promise<Array<{ number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>>}
 */
async function getGitHubIssuesForRepository() {
  const issues = [];
  const iterator = octokit.paginate.iterator(octokit.rest.issues.listForRepo, {
    owner: process.env.GITHUB_REPO_OWNER,
    repo: process.env.GITHUB_REPO_NAME,
    state: "all",
    per_page: 100,
  });
  for await (const { data } of iterator) {
    for (const issue of data) {
      if (!issue.pull_request) {
        issues.push({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          comment_count: issue.comments,
          url: issue.html_url,
        });
      }
    }
  }
  return issues;
}

/**
 * Notion 데이터베이스에 이미 존재하는 issue를 할당합니다.
 *
 * @param {Array<{ number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>} issues
 * @returns {{
 *   pagesToCreate: Array<{ number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>;
 *   pagesToUpdate: Array<{ pageId: string, number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>
 * }}
 */
function getNotionOperations(issues) {
  const pagesToCreate = [];
  const pagesToUpdate = [];
  for (const issue of issues) {
    const pageId = gitHubIssuesIdToNotionPageId[issue.number];
    if (pageId) {
      pagesToUpdate.push({
        ...issue,
        pageId,
      });
    } else {
      pagesToCreate.push(issue);
    }
  }
  return { pagesToCreate, pagesToUpdate };
}

/**
 * Notion에서 새 페이지를 만듭니다.
 *
 * https://developers.notion.com/reference/post-page
 *
 * @param {Array<{ number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>} pagesToCreate
 */
async function createPages(pagesToCreate) {
  const pagesToCreateChunks = _.chunk(pagesToCreate, OPERATION_BATCH_SIZE);
  for (const pagesToCreateBatch of pagesToCreateChunks) {
    await Promise.all(
      pagesToCreateBatch.map((issue) =>
        notion.pages.create({
          parent: { database_id: databaseId },
          properties: getPropertiesFromIssue(issue),
        })
      )
    );
    console.log(`Completed batch size: ${pagesToCreateBatch.length}`);
  }
}

/**
 * Notion에서 제공된 페이지를 업데이트합니다.
 *
 * https://developers.notion.com/reference/patch-page
 *
 * @param {Array<{ pageId: string, number: number, title: string, state: "open" | "closed", comment_count: number, url: string }>} pagesToUpdate
 */
async function updatePages(pagesToUpdate) {
  const pagesToUpdateChunks = _.chunk(pagesToUpdate, OPERATION_BATCH_SIZE);
  for (const pagesToUpdateBatch of pagesToUpdateChunks) {
    await Promise.all(
      pagesToUpdateBatch.map(({ pageId, ...issue }) =>
        notion.pages.update({
          page_id: pageId,
          properties: getPropertiesFromIssue(issue),
        })
      )
    );
    console.log(`Completed batch size: ${pagesToUpdateBatch.length}`);
  }
}

syncButton.addEventListener("click", (e) => {
  console.log("dsds");
  startSync();
});

//*========================================================================
// helpers
//*========================================================================

/**
 * 이 데이터베이스의 스키마 속성을 준수하도록 GitHub issue를 반환합니다.
 *
 * @param {{ number: number, title: string, state: "open" | "closed", comment_count: number, url: string }} issue
 */
function getPropertiesFromIssue(issue) {
  const { title, number, state, comment_count, url } = issue;
  return {
    Name: {
      title: [{ type: "text", text: { content: title } }],
    },
    "Issue Number": {
      number,
    },
    State: {
      select: { name: state },
    },
    "Number of Comments": {
      number: comment_count,
    },
    "Issue URL": {
      url,
    },
  };
}
