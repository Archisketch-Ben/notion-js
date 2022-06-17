import "./config/env.js";
import { Client } from "@notionhq/client";
import "./github-sync.js";

const notion = new Client({ auth: process.env.NOTION_KEY });

const databaseId = process.env.NOTION_QA_DB_KEY;

async function addItem(text) {
  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        title: {
          title: [
            {
              text: {
                content: text,
              },
            },
          ],
        },
      },
    });
    console.log(response);
    console.log("Success! Entry added.");
  } catch (error) {
    console.error(error.body);
  }
}

addItem("test");

/**
 * 이 데이터베이스의 스키마 속성을 준수하도록 QA 테스트 결과를 반환합니다.
 *
 * @param {{}} testCase
 */
function getPropertiesFromQATestCase(testCase) {
  const {} = testCase;
}
