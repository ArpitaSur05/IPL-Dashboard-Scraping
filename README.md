# 🏏 IPL T20 Live Dashboard - Backend

This backend service powers the IPL T20 Live Dashboard by scraping real-time data from [iplt20.com](https://www.iplt20.com) using **Puppeteer**. It provides API endpoints for live matches, mini scorecards, the match schedule, and the points table.

Please note that, the real time data update/notification has been implemented only for the match summary which would give information only when any live match is going on below the live-match-card.

---

## ⚙️ Tech Stack

- **Runtime**: Node.js
- **Scraping**: Puppeteer + Cheerio
- **Language**: TypeScript
- **Server**: Hono.js
- **Package Manager**: pnpm

---

## 🛠 How to Run Locally

### 1. Clone the repositories

```bash
Frontend => git clone https://github.com/ArpitaSur05/IPL-T20-Dashboard-Frontend.git
Backend => git clone https://github.com/ArpitaSur05/IPL-Dashboard-Scraping.git
```

### 2. Install dependencies

```bash

Backend => pnpm i (Make sure the backend runs at 3000 port)
Frontend => pnpm i

```
