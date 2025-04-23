import { serve } from "@hono/node-server";
import * as cheerio from "cheerio";
import { Hono } from "hono";
import puppeteer from "puppeteer";
import Pusher from "pusher";

const app = new Hono();

const pusher = new Pusher({
  appId: "1979446",
  key: "1aca8f81365e8b3cb9d4",
  secret: "8d9c60733e223c553dec",
  cluster: "ap2",
  useTLS: true,
});

app.get("/points-table", async (c) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://www.iplt20.com/points-table/men",  {
    timeout: 60000,
  });
  const content = await page.content();

  const $ = cheerio.load(content);
  const table = $(".ih-pcard-sec");

  const rows: any[] = [];

  table.find("tbody > tr").each((i, el) => {
    const cells = $(el)
      .text()
      .trim()
      .split(/\s+/)
      .filter((cell) => cell.length > 0);

    // Handle header row separately (first row only)
    if (i === 0) {
      const lastCombined = `${cells[cells.length - 2]} ${
        cells[cells.length - 1]
      }`;
      const headerRow = [...cells.slice(0, -2), lastCombined];
      rows.push(headerRow);
    } else {
      rows.push(cells);
    }
  });

  const headerRow = rows[0];
  console.log("Header Row:", headerRow);
  console.log(" Row:", rows[1]);
  await browser.close();
  return c.json({
    headerRow,
    rows: rows.slice(1),
  });
});

app.get("/match-schedule", async (c) => {
  const browser = await puppeteer.launch({ headless: false }); // Use false for debugging
  const page = await browser.newPage();

  await page.setViewport({ width: 1280, height: 800 });

  await page.goto("https://www.iplt20.com/matches/fixtures", {
    waitUntil: "networkidle0",
    timeout: 60000,
  });

  await page.waitForSelector("li[ng-repeat='list in fixLiveList']", {
    timeout: 60000,
  });

  const matches = await page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll("li[ng-repeat='list in fixLiveList']")
    );

    return items.map((el) => {
      const isLive = el.classList.contains("live-match");

      const matchNo =
        el.querySelector(".vn-matchOrder")?.textContent?.trim() || "";
      const matchDate =
        el.querySelector(".vn-matchDate")?.textContent?.trim() || "";
      const matchTime =
        el.querySelector(".vn-matchTime")?.textContent?.trim() || "";
      const matchVenue =
        el.querySelector(".vn-venueDet p")?.textContent?.trim() || "";

      const team1Name =
        el
          .querySelector(".vn-shedTeam .vn-teamTitle h3")
          ?.textContent?.trim() || "";
      const team2Name =
        el.querySelector(".vn-team-2 .vn-teamTitle h3")?.textContent?.trim() ||
        "";

      // Scraping team logos correctly
      const team1Logo =
        el.querySelector(".vn-shedTeam img.schTeamLogo")?.getAttribute("src") ||
        "";
      const team2Logo =
        el
          .querySelector(".vn-shedTeam.vn-team-2 img.schTeamLogo")
          ?.getAttribute("src") || "";

      const matchStatus =
        el.querySelector(".vn-ticketTitle")?.textContent?.trim() || "";
      const matchLink =
        el.querySelector(".vn-matchBtn")?.getAttribute("href") || "";

      return {
        matchNo,
        matchDate,
        matchTime,
        matchVenue,
        team1: team1Name,
        team2: team2Name,
        team1Logo,
        team2Logo,
        matchStatus,
        matchLink,
        live: isLive,
      };
    });
  });

  console.log("✅ Scraped Match Schedule with Team Logos:");
  console.log(matches);

  await browser.close();
  return c.json(matches);
});

app.get("/score-card", async (c) => {
  const matchLink = c.req.query("matchLink");

  if (!matchLink) {
    return c.json({ error: "matchLink query parameter is required" }, 400);
  }
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  // await page.goto("https://www.iplt20.com/match/2025/1837"); // use actual live match page URL

  await page.goto(matchLink, {
    waitUntil: "networkidle2",
    timeout: 120000,
  });

  const content = await page.content();
  const $ = cheerio.load(content);

  const scoreCard: any = {
    striker: null,
    nonStriker: null,
    bowler: null,
  };

  const table = $("#miniscoreCard");

  const batter = table.find(".battingCardMC");

  const players = batter.find(".mcRowData");

  const rows: {
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
  }[] = [];

  players.each((i, el) => {
    const player = $(el);
    const name = player.find(".sc-pnam > .playerName").text().trim();
    // console.log(name.text());
    const playerData = player.find(".plyData").eq(0).text().trim().split(/\s+/);

    const runs = playerData[0];
    const balls = playerData[1];
    const fours = playerData[2];
    const sixes = playerData[3];

    rows.push({
      name,
      runs: +runs,
      balls: +balls,
      fours: +fours,
      sixes: +sixes,
    });
  });

  const battingHeaders = [];

  const data = batter.text().trim().split(/\s+/);
  const title = data[0].trim();
  battingHeaders.push(title);
  battingHeaders.push(data[1]);
  battingHeaders.push(data[2]);
  battingHeaders.push(data[3]);
  battingHeaders.push(data[4]);

  const bowlingHeaders: any[] = [];
  const bowling = table.find(".bowlingCardMC");

  const headers = bowling.find(".mcRowHead");
  headers.each((i, el) => {
    const header = $(el).text().trim().split(/\s+/);
    bowlingHeaders.push([...header]);
  });

  const bowler = bowling.find(".mcRowData");
  const bowlerName = bowler.find(".sc-pnam > .playerName").text().trim();
  const bowlerData = bowler.find(".plyData").eq(0).text().trim().split(/\s+/);

  const overs = bowlerData[0];
  const runs = bowlerData[1];
  const wickets = bowlerData[2];
  const maidens = bowlerData[3];
  const economy = bowlerData[4];

  await browser.close();

  const responseData = {
    batting: {
      headers: battingHeaders,
      rows,
    },
    bowling: {
      headers: bowlingHeaders,
      rows: [
        {
          name: bowlerName,
          overs: +overs,
          runs: +runs,
          wickets: +wickets,
          maidens: +maidens,
          economy: +economy,
        },
      ],
    },
  };
  
  console.log("🎯 /score-card data:", JSON.stringify(responseData, null, 2));
  await browser.close();
  return c.json(responseData);
});

app.get("/live-match", async (c) => {
  const matchLink = c.req.query("matchLink");

  if (!matchLink) {
    return c.json({ error: "matchLink query parameter is required" }, 400);
  }

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(matchLink, {
    waitUntil: "networkidle2",
    timeout: 120000,
  });

  try {
    await page.waitForSelector(".ap-teams-battle-wrp", { timeout: 60000 });
    const liveMatch : any = await page.evaluate(() => {
      const root = document.querySelector(".ap-teams-battle-wrp");
      if (!root) return null;

      const team1Logo =
        root.querySelector(".msLBlock .tLogo img")?.getAttribute("src") || "";
      const team1Name =
        root.querySelector(".msLBlock .tLogo img")?.getAttribute("alt") || "";
      const team1Score =
        root.querySelector(".msLBlock .ap-total-runs")?.textContent?.trim() ||
        "";
      const team1Overs =
        root.querySelector(".msLBlock .ap-runs-overs")?.textContent?.trim() ||
        "";

      const team2Logo =
        root.querySelector(".msRBlock .tLogo img")?.getAttribute("src") || "";
      const team2Name =
        root.querySelector(".msRBlock .tLogo img")?.getAttribute("alt") || "";
      const team2Score =
        root.querySelector(".msRBlock .ap-total-runs")?.textContent?.trim() ||
        "";
      const team2Overs =
        root.querySelector(".msRBlock .ap-runs-overs")?.textContent?.trim() ||
        "";

      const matchNumber =
        root.querySelector(".matchOrder")?.textContent?.trim() || "";
      const matchSummary =
        document.querySelector(".ms-matchComments")?.textContent?.trim() || "";
      const isLive = document.querySelector(".live-match") ? "Yes" : "No";


      return {
        matchNumber,
        team1: {
          name: team1Name,
          logo: team1Logo,
          score: team1Score,
          overs: team1Overs,
        },
        team2: {
          name: team2Name,
          logo: team2Logo,
          score: team2Score,
          overs: team2Overs,
        },
        matchSummary,
        liveMatch: isLive,
      };
    });
    console.log(liveMatch);
    await browser.close();

    if (!liveMatch) {
      return c.json({ message: "No live match data found" }, 404);
    }

    pusher.trigger("my-channel", "update", liveMatch);

    return c.json(liveMatch);
  } catch (err: any) {
    await browser.close();
    console.error("❌ Error scraping live match:", err);
    return c.json(
      { error: "Failed to fetch live match", details: err.message },
      500
    );
  }
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