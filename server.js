const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cron = require("node-cron");
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

const NEWS_API = process.env.NEWS_API_KEY;

async function fetchNews() {
  try {
    const response = await axios.get(
      `https://newsapi.org/v2/top-headlines?language=en&pageSize=5&apiKey=${NEWS_API}`
    );

    for (let article of response.data.articles) {
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Summarize this news and classify category (war, protest, disaster, virus, politics). Also give severity 1-10 and risk prediction 1-10 in JSON format.",
          },
          {
            role: "user",
            content: article.title + " " + article.description,
          },
        ],
      });

      let result;
      try {
        result = JSON.parse(aiResponse.choices[0].message.content);
      } catch {
        continue;
      }

      await supabase.from("events").insert({
        title: article.title,
        summary: result.summary,
        category: result.category,
        severity: result.severity,
        risk_prediction: result.risk_prediction,
        credibility: 0.9,
        latitude: 0,
        longitude: 0,
        source_url: article.url,
      });
    }

    console.log("News updated.");
  } catch (err) {
    console.error(err.message);
  }
}

cron.schedule("*/10 * * * *", fetchNews);

app.get("/", (req, res) => {
  res.json({ message: "Sentinel Backend Running" });
});

app.get("/events", async (req, res) => {
  const { data } = await supabase
    .from("events")
    .select("*")
    .order("date_time", { ascending: false })
    .limit(100);

  res.json(data);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running"));
