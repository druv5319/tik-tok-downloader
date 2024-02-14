const tiktok = require("tiktok-scraper-without-watermark");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dataDir = "./data";
const creatorsDir = "./creators";
const coversDir = "./covers";
const videosDir = "./videos";

async function downloadVideo(id, url) {
  console.log("downloading video", id);
  const videoPath = path.join(videosDir, `${id}.mp4`);
  const videoStream = fs.createWriteStream(videoPath);

  await axios({
    url,
    method: "GET",
    responseType: "stream",
  })
    .then((response) => {
      response.data.pipe(videoStream);
      videoStream.on("finish", () => console.log("saved video", id));
      videoStream.on("error", (error) =>
        console.error("error saving video", id, error)
      );
    })
    .catch((error) => {
      console.error("error downloading video", id, error);
    });
}

async function downloadCover(id, url) {
  console.log("downloading cover", id);
  const coverPath = path.join(coversDir, `${id}.jpg`);
  const coverStream = fs.createWriteStream(coverPath);

  await axios({
    url,
    method: "GET",
    responseType: "stream",
  })
    .then((response) => {
      response.data.pipe(coverStream);
      coverStream.on("finish", () => console.log("saved cover", id));
      coverStream.on("error", (error) =>
        console.error("error streaming cover", id, error)
      );
    })
    .catch((error) => {
      console.error("error downloading cover", id, error);
    });
}

async function fetchVideo(videoUrl) {
  console.log("fetchting video", videoUrl);
  let data;
  try {
    data = await tiktok.tiklydown(videoUrl);
  } catch (err) {
    console.error("error downloading tiktok data", videoUrl, err);
    return;
  }
  console.log("got data", data.id);

  // download the video async so we can keep moving
  downloadVideo(data.id, data.video.noWatermark);
  downloadCover(data.id, data.video.cover);
  return data;
}

function extractExistingData(jsonFilePath) {
  try {
    const data = fs.readFileSync(jsonFilePath, { encoding: "utf8" });
    if (data) {
      const parsedData = JSON.parse(data);
      return (parsedData && parsedData.videos) || [];
    }
  } catch (error) {
    console.error("Error reading existing JSON file:", error);
  }
  // if no data was returned, return an empty array
  return [];
}

async function parseFile(file) {
  const filePath = path.join(creatorsDir, file);
  // only parse .txt files
  if (!filePath.endsWith(".txt")) return;
  const videoUrls = fs
    .readFileSync(filePath, "utf8")
    .toString()
    .split("\n")
    .filter((url) => url);

  const jsonFilename = path.basename(filePath).replace(".txt", ".json");
  const jsonFilePath = path.join(dataDir, jsonFilename);
  const existingData = extractExistingData(jsonFilePath);
  console.log("got data:", existingData);

  // Open a JSON file to write data progressively
  const stream = fs.createWriteStream(jsonFilePath, { flags: "w" });
  if (existingData.length > 0) {
    stream.write(JSON.stringify({ videos: existingData }).slice(0, -2) + ",");
  } else {
    stream.write('{"videos": [');
  }

  // Iterate, fetch and parse all videos
  for (let i = 0; i < videoUrls.length; i++) {
    const videoUrl = videoUrls[i];
    const videoId = videoUrl.split("/").pop();
    // if we already have this data, skip it
    if (existingData.find((video) => video.id == videoId)) {
      console.log("skipping video", videoId);
      continue;
    }

    const videoData = await fetchVideo(videoUrl, stream);

    // only write data if it was fetched
    if (videoData) {
      if (i) stream.write(",");
      stream.write(JSON.stringify(videoData));
    }
  }
  stream.write("]}");
  stream.end();
}

async function main() {
  // Fetch all files in /creators and iterate through them
  const files = await fs.promises.readdir(creatorsDir);
  for (const file of files) parseFile(file);
}

main();
