const tiktok = require("tiktok-scraper-without-watermark");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const creatorsDir = "./creators";

// get a filename, and make sure that the creator directory exists
function getFileName(creator, id, ext) {
  // make sure there's a directory for data
  if (!fs.existsSync("./data")) fs.mkdirSync("./data");

  // make sure there's a directory for the creator
  const creatorPath = path.join("./data", creator);
  if (!fs.existsSync(creatorPath)) fs.mkdirSync(creatorPath);
  return path.join(creatorPath, `${id}.${ext}`);
}

// see if a file exists, and if so return its contents
function getFileData(fileName) {
  if (!fs.existsSync(fileName)) return null;
  return fs.readFileSync(fileName);
}

function deleteFile(fileName) {
  if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
}

async function downloadCover(creator, id, url) {
  const fileName = getFileName(creator, id, "jpg");
  if (getFileData(fileName)) {
    console.log("cover already exists", creator, id);
    return;
  }

  const coverStream = fs.createWriteStream(fileName);
  axios({
    url,
    method: "GET",
    responseType: "stream",
  })
    .then((response) => {
      response.data.pipe(coverStream);
      coverStream.on("finish", () => console.log("cover saved", creator, id));
      coverStream.on("error", (error) => {
        console.log("cover streaming error", id, error);
        // delete the cover if it was partially saved
        deleteFile(fileName);
      });
    })
    .catch((error) => {
      console.log("cover downloading error", id, error);
    });
}

function downloadVideo(creator, id, url) {
  const fileName = getFileName(creator, id, "mp4");
  if (getFileData(fileName)) {
    console.log("video already exists", creator, id);
    return;
  }

  const videoStream = fs.createWriteStream(fileName);
  axios({
    url,
    method: "GET",
    responseType: "stream",
  })
    .then((response) => {
      response.data.pipe(videoStream);
      videoStream.on("finish", () => console.log("video saved", creator, id));
      videoStream.on("error", (error) => {
        console.log("video saving error", creator, id, error);
        // delete the video if it was partially saved
        deleteFile(fileName);
      });
    })
    .catch((error) => {
      console.log("video downloading error", id, error);
    });
}

async function fetchData(creator, id, videoUrl) {
  const fileName = getFileName(creator, id, "json");

  // first, see if we already have the data
  const existingData = getFileData(fileName);
  if (existingData) {
    try {
      const parsedData = JSON.parse(existingData);
      console.log("data  already exists", creator, id);
      return parsedData;
    } catch (err) {
      console.log("data  parsing error", creator, id, err);
    }
  }

  try {
    const data = await tiktok.tiklydown(videoUrl);
    // make sure the data is good
    if (!data || !data.video || !data.video.noWatermark || !data.video.cover) {
      throw new Error("data  format problem", creator, id, data);
    }
    fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
    console.log("data  saved", creator, id);
    return data;
  } catch (err) {
    console.log("data  fetching error", creator, id, err);
  }
}

async function saveVideo(videoUrl) {
  const creator = videoUrl.split("@").pop().split("/").shift();
  const id = videoUrl.split("/").pop();
  const data = await fetchData(creator, id, videoUrl);
  if (data && data.video) {
    downloadVideo(creator, id, data.video.noWatermark);
    downloadCover(creator, id, data.video.cover);
  } else {
    console.log("no data for", creator, id);
  }
}

async function main() {
  // Fetch all .txt files in /creators
  const files = (await fs.promises.readdir(creatorsDir)).filter((file) =>
    file.endsWith(".txt")
  );

  for (const file of files) {
    const filePath = path.join(creatorsDir, file);
    const videoUrls = fs
      .readFileSync(filePath, "utf8")
      .toString()
      .split("\n")
      .filter((url) => url);

    for (const url of videoUrls) {
      // await each so we don't start getting 429s
      await saveVideo(url);
    }
  }
}

main();
