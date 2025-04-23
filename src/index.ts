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
  await page.goto("https://www.iplt20.com/points-table/men", {
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

  await browser.close();
  return c.json(responseData);
});

let globalMatchLink = "";

app.get("/live-match", async (c) => {
  const matchLink = c.req.query("matchLink");
  if (!matchLink) {
    return c.json({ error: "matchLink query parameter is required" }, 400);
  }

  globalMatchLink = matchLink;

  const liveMatch = await getLiveMatch(matchLink);
  if (liveMatch.error) {
    return c.json(liveMatch, 400);
  }
  return c.json(liveMatch);
});

setInterval(async () => {
  if (globalMatchLink) {
    const matchLink = globalMatchLink; // Replace with the actual match link
    const liveMatch = await getLiveMatch(matchLink);
    if (liveMatch.error) {
      console.error("Error fetching live match:", liveMatch.error);
    }

    pusher.trigger("my-channel", "update", liveMatch);
  }
}, 15000); // Fetch every 60 seconds

async function getLiveMatch(matchLink: string | undefined) {
  console.log("live match");
  if (!matchLink) {
    return { error: "matchLink query parameter is required" };
  }

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(matchLink, {
    waitUntil: "domcontentloaded", // or "load"
    timeout: 120000,
  });
  try {
    await page.waitForSelector(".ap-teams-battle-wrp", { timeout: 120000 });
    const liveMatch: any = await page.evaluate(() => {
      const root = document.querySelector(".ap-teams-battle-wrp");
      console.log(root);
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

      let summaryText = "";
      const matchSummary = document
        .querySelectorAll(".ms-matchComments")
        ?.forEach((el) => {
          const text = el.textContent?.trim() || "";
          if (text) {
            summaryText = text;
            return;
          }
        });

      console.log(document.querySelector(".ms-matchComments"));
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
        matchSummary: summaryText,
        liveMatch: isLive,
      };
    });
    await browser.close();

    if (!liveMatch) {
      return { error: "No live match data found" };
    }

    return liveMatch;
  } catch (err: any) {
    await browser.close();
    console.error("❌ Error scraping live match:", err);
    return { error: "Failed to fetch live match", details: err.message };
  }
}

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
