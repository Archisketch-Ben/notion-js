import "./env.js"
import { Client } from "@notionhq/client"

console.log(process.env.NOTION_KEY);
console.log(process.env.NOTION_QA_DB_KEY);

const notion = new Client({ auth: process.env.NOTION_KEY })

const databaseId = process.env.NOTION_QA_DB_KEY

async function addItem(text) {
  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        title: { 
          title:[
            {
              "text": {
                "content": text
              }
            }
          ]
        }
      },
    })
    console.log(response)
    console.log("Success! Entry added.")
  } catch (error) {
    console.error(error.body)
  }
}

addItem("Yurts in Big Sur, California")