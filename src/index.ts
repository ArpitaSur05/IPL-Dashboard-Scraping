import { serve } from "@hono/node-server";
import * as cheerio from "cheerio";
import { Hono } from "hono";
import puppeteer from "puppeteer";

const app = new Hono();

app.get("/points-table", async (c) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://www.iplt20.com/points-table/men");
  const content = await page.content();

  const $ = cheerio.load(content);
  const table = $(".ih-pcard-sec");

  const rows: any[] = [];

  table.find("tbody > tr").each((i, el) => {
    const cells = $(el)
      .text()
      .trim()
      .split(/\s+/)
      .filter((cell) => cell.length > 0)
  
    // Handle header row separately (first row only)
    if (i === 0) {
      const lastCombined = `${cells[cells.length - 2]} ${cells[cells.length - 1]}`
      const headerRow = [...cells.slice(0, -2), lastCombined]
      rows.push(headerRow)
    } else {
      rows.push(cells)
    }
  })

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

  await page.waitForSelector("li[ng-repeat='list in fixLiveList']",{ timeout: 60000 });

  const matches = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("li[ng-repeat='list in fixLiveList']"));

    return items.map((el) => {
      const isLive = el.classList.contains("live-match");

      const matchNo = el.querySelector(".vn-matchOrder")?.textContent?.trim() || "";
      const matchDate = el.querySelector(".vn-matchDate")?.textContent?.trim() || "";
      const matchTime = el.querySelector(".vn-matchTime")?.textContent?.trim() || "";
      const matchVenue = el.querySelector(".vn-venueDet p")?.textContent?.trim() || "";

      const team1Name = el.querySelector(".vn-shedTeam .vn-teamTitle h3")?.textContent?.trim() || "";
      const team2Name = el.querySelector(".vn-team-2 .vn-teamTitle h3")?.textContent?.trim() || "";

      // Scraping team logos correctly
      const team1Logo = el.querySelector(".vn-shedTeam img.schTeamLogo")?.getAttribute("src") || "";
      const team2Logo = el.querySelector(".vn-shedTeam.vn-team-2 img.schTeamLogo")?.getAttribute("src") || "";

      const matchStatus = el.querySelector(".vn-ticketTitle")?.textContent?.trim() || "";
      const matchLink = el.querySelector(".vn-matchBtn")?.getAttribute("href") || "";

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


// app.get("/live-match", async (c) => {
//   const matchLink = c.req.query("matchlink");

//   if (!matchLink) {
//     return c.json({ error: "matchLink query parameter is required" }, 400);
//   }

//   const browser = await puppeteer.launch({
//     headless: false,
//     args: ["--no-sandbox", "--disable-setuid-sandbox"],
//   });

//   const page = await browser.newPage();
//   await page.goto(matchLink, {
//     waitUntil: "networkidle2",
//     timeout: 60000,
//   });

//   try {
//     await page.waitForSelector(".ap-teams-battle-wrp", { timeout: 60000 });

//     const liveMatch = await page.evaluate(() => {
//       const root = document.querySelector(".ap-teams-battle-wrp");
//       if (!root) return null;

//       const team1Logo = root.querySelector(".msLBlock .tLogo img")?.getAttribute("src") || "";
//       const team1Name = root.querySelector(".msLBlock .tLogo img")?.getAttribute("alt") || "";
//       const team1Score = root.querySelector(".msLBlock .ap-total-runs")?.textContent?.trim() || "";
//       const team1Overs = root.querySelector(".msLBlock .ap-runs-overs")?.textContent?.trim() || "";

//       const team2Logo = root.querySelector(".msRBlock .tLogo img")?.getAttribute("src") || "";
//       const team2Name = root.querySelector(".msRBlock .tLogo img")?.getAttribute("alt") || "";
//       const team2Score = root.querySelector(".msRBlock .ap-total-runs")?.textContent?.trim() || "";
//       const team2Overs = root.querySelector(".msRBlock .ap-runs-overs")?.textContent?.trim() || "";

//       const matchNumber = root.querySelector(".matchOrder")?.textContent?.trim() || "";
//       const matchSummary = document.querySelector(".ms-matchComments")?.textContent?.trim() || "";
//       const isLive = document.querySelector(".live-match") ? "Yes" : "No";

//       // Mini Scorecard Extraction
//       const strikerEls = document.querySelectorAll(".playerWagonBatting.stricker");
//       const striker = strikerEls[0]
//         ? {
//             name: strikerEls[0].querySelector(".playerName")?.textContent?.trim() || "",
//             status: strikerEls[0].querySelector(".dismissalSmall")?.textContent?.trim() || "",
//             runs: strikerEls[0].querySelector("[ng-bind='CurrentStrikerData.Runs']")?.textContent?.trim() || "",
//             balls: strikerEls[0].querySelector("[ng-bind='CurrentStrikerData.Balls']")?.textContent?.trim() || "",
//             fours: strikerEls[0].querySelector("[ng-bind='CurrentStrikerData.Fours']")?.textContent?.trim() || "",
//             sixes: strikerEls[0].querySelector("[ng-bind='CurrentStrikerData.Sixes']")?.textContent?.trim() || "",
//           }
//         : null;

//       const nonStriker = strikerEls[1]
//         ? {
//             name: strikerEls[1].querySelector(".playerName")?.textContent?.trim() || "",
//             status: strikerEls[1].querySelector(".dismissalSmall")?.textContent?.trim() || "",
//             runs: strikerEls[1].querySelector("[ng-bind='CurrentNonStrikerData.Runs']")?.textContent?.trim() || "",
//             balls: strikerEls[1].querySelector("[ng-bind='CurrentNonStrikerData.Balls']")?.textContent?.trim() || "",
//             fours: strikerEls[1].querySelector("[ng-bind='CurrentNonStrikerData.Fours']")?.textContent?.trim() || "",
//             sixes: strikerEls[1].querySelector("[ng-bind='CurrentNonStrikerData.Sixes']")?.textContent?.trim() || "",
//           }
//         : null;

//       const bowlerEl = document.querySelector(".playerWagonBowling.Bowler");
//       const bowler = bowlerEl
//         ? {
//             name: bowlerEl.querySelector(".playerName")?.textContent?.trim() || "",
//             overs: bowlerEl.querySelector("[ng-bind='CurrentBowlerData.Overs']")?.textContent?.trim() || "",
//             runsConceded: bowlerEl.querySelector("[ng-bind='CurrentBowlerData.Runs']")?.textContent?.trim() || "",
//             wickets: bowlerEl.querySelector("[ng-bind='CurrentBowlerData.Wickets']")?.textContent?.trim() || "",
//             dots: bowlerEl.querySelector("[ng-bind='CurrentBowlerData.Dots']")?.textContent?.trim() || "",
//             economy: bowlerEl.querySelector("[ng-bind='CurrentBowlerData.Economy']")?.textContent?.trim() || "",
//           }
//         : null;

//       return {
//         matchNumber,
//         team1: {
//           name: team1Name,
//           logo: team1Logo,
//           score: team1Score,
//           overs: team1Overs,
//         },
//         team2: {
//           name: team2Name,
//           logo: team2Logo,
//           score: team2Score,
//           overs: team2Overs,
//         },
//         matchSummary,
//         liveMatch: isLive,
//         miniScorecard: {
//           matchPhase: matchSummary,
//           striker,
//           nonStriker,
//           bowler,
//         },
//       };
//     });

//     await browser.close();

//     if (!liveMatch) {
//       return c.json({ message: "No live match data found" }, 404);
//     }

//     return c.json(liveMatch);
//   } catch (err: any) {
//     await browser.close();
//     console.error("❌ Error scraping live match:", err.message);
//     return c.json({ error: "Failed to fetch live match", details: err.message }, 500);
//   }
// });

app.get("/score-card", async (c) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://www.iplt20.com/match/2025/1837"); // use actual live match page URL

  const content = await page.content();
  const $ = cheerio.load(content);

  const scoreCard: any = {
    striker: null,
    nonStriker: null,
    bowler: null,
  };

  // STRIKER
  const strikerEl = $(".striker .cb-col.cb-col-100.cb-batsman-cell");
  scoreCard.striker = {
    name: strikerEl.find(".cb-font-16.text-black.text-bold.cb-ellipsis-line").text().trim(),
    runs: strikerEl.find(".cb-col.cb-col-33").eq(0).text().trim(),
    ballsFaced: strikerEl.find(".cb-col.cb-col-33").eq(1).text().trim(),
    strikeRate: strikerEl.find(".cb-col.cb-col-33").eq(2).text().trim(),
  };

  // NON-STRIKER
  const nonStrikerEl = $(".non-striker .cb-col.cb-col-100.cb-batsman-cell");
  scoreCard.nonStriker = {
    name: nonStrikerEl.find(".cb-font-16.text-black.text-bold.cb-ellipsis-line").text().trim(),
    runs: nonStrikerEl.find(".cb-col.cb-col-33").eq(0).text().trim(),
    ballsFaced: nonStrikerEl.find(".cb-col.cb-col-33").eq(1).text().trim(),
    strikeRate: nonStrikerEl.find(".cb-col.cb-col-33").eq(2).text().trim(),
  };

  // BOWLER
  const bowlerEl = $(".bowler .cb-col.cb-col-100.cb-col-with-shadow");
  scoreCard.bowler = {
    name: bowlerEl.find(".cb-font-16.text-black.text-bold.cb-ellipsis-line").text().trim(),
    overs: bowlerEl.find(".cb-col.cb-col-33").eq(0).text().trim(),
    maidens: bowlerEl.find(".cb-col.cb-col-33").eq(1).text().trim(),
    runsConceded: bowlerEl.find(".cb-col.cb-col-33").eq(2).text().trim(),
    wickets: bowlerEl.find(".cb-col.cb-col-33").eq(3).text().trim(),
    economy: bowlerEl.find(".cb-col.cb-col-33").eq(4).text().trim(),
  };

  await browser.close();
  return c.json(scoreCard);
});


app.get("/live-match", async (c) => {
  const matchLink = c.req.query("matchLink")

  if (!matchLink) {
    return c.json({ error: "matchLink query parameter is required" }, 400)
  }

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  const page = await browser.newPage()
  await page.goto(matchLink, {
    waitUntil: "networkidle2",
    timeout: 60000,
  })

  try {
    await page.waitForSelector(".ap-teams-battle-wrp", { timeout: 60000 })

    const liveMatch = await page.evaluate(() => {
      const root = document.querySelector(".ap-teams-battle-wrp")
      if (!root) return null

      const team1Logo = root.querySelector(".msLBlock .tLogo img")?.getAttribute("src") || ""
      const team1Name = root.querySelector(".msLBlock .tLogo img")?.getAttribute("alt") || ""
      const team1Score = root.querySelector(".msLBlock .ap-total-runs")?.textContent?.trim() || ""
      const team1Overs = root.querySelector(".msLBlock .ap-runs-overs")?.textContent?.trim() || ""

      const team2Logo = root.querySelector(".msRBlock .tLogo img")?.getAttribute("src") || ""
      const team2Name = root.querySelector(".msRBlock .tLogo img")?.getAttribute("alt") || ""
      const team2Score = root.querySelector(".msRBlock .ap-total-runs")?.textContent?.trim() || ""
      const team2Overs = root.querySelector(".msRBlock .ap-runs-overs")?.textContent?.trim() || ""

      const matchNumber = root.querySelector(".matchOrder")?.textContent?.trim() || ""
      const matchSummary = document.querySelector(".ms-matchComments")?.textContent?.trim() || ""
      const isLive = document.querySelector(".live-match") ? "Yes" : "No"

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
      }
    })

    await browser.close()

    if (!liveMatch) {
      return c.json({ message: "No live match data found" }, 404)
    }

    return c.json(liveMatch)
  } catch (err: any) {
    await browser.close()
    console.error("❌ Error scraping live match:", err.message)
    return c.json({ error: "Failed to fetch live match", details: err.message }, 500)
  }
})









serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
