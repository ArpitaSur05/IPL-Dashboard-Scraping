import { serve } from "@hono/node-server";
import * as cheerio from "cheerio";
import { Hono } from "hono";
import puppeteer from "puppeteer";

const app = new Hono();

app.get("/", async (c) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://www.iplt20.com/points-table/men");
  const content = await page.content();

  const $ = cheerio.load(content);
  const table = $(".ih-pcard-sec");

  const rows = [];

  table.find("tbody>tr").each((i, el) => {
    rows.push(
      $(el)
        .text()
        .split(/[ ]+/)
        .filter((row) => row.length > 0)
    );
  });

  const headerRow = rows[0];
  console.log("Header Row:", headerRow);

  return c.json({
    headerRow,
    rows: rows.slice(1),
  });
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
