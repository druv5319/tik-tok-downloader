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

async function downloadFile(creator, id, ext, url) {
  const fileName = getFileName(creator, id, ext);
  if (getFileData(fileName)) {
    console.log(`${ext} already exists`, creator, id);
    return;
  }

  const stream = fs.createWriteStream(fileName);
  axios({ url, method: "GET", responseType: "stream" })
    .then((response) => {
      response.data.pipe(stream);
      stream.on("finish", () => console.log(`${ext}  saved`, creator, id));
      stream.on("error", (error) => {
        console.log(`${ext}  stream error`, id, error);
        // delete the cover if it was partially saved
        deleteFile(fileName);
      });
    })
    .catch((error) => {
      console.log(`${ext}  download error`, id, error);
    });
}

async function fetchData(creator, id, videoUrl) {
  const fileName = getFileName(creator, id, "json");

  // first, see if we already have the data
  const existingData = getFileData(fileName);
  if (existingData) {
    try {
      const parsedData = JSON.parse(existingData);
      console.log("data already exists", creator, id);
      return parsedData;
    } catch (err) {
      console.log("data parsing error", creator, id, err);
    }
  }

  try {
    const data = await tiktok.tiklydown(videoUrl);
    // make sure the data is good
    if (!data || !data.video || !data.video.noWatermark || !data.video.cover) {
      throw new Error("data format problem", creator, id, data);
    }
    fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
    console.log("data saved", creator, id);
    return data;
  } catch (err) {
    console.log("data fetching error", creator, id, err);
  }
}

async function saveVideo(videoUrl) {
  const creator = videoUrl.split("@").pop().split("/").shift();
  const id = videoUrl.split("/").pop();
  const data = await fetchData(creator, id, videoUrl);
  if (data && data.video) {
    downloadFile(creator, id, "mp4", data.video.noWatermark);
    downloadFile(creator, id, "jpg", data.video.cover);
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

    for (const [i, url] of videoUrls.entries()) {
      // await each so we don't start getting 429s
      await saveVideo(url);
      console.log(`${i + 1} of ${videoUrls.length} videos saved`);
    }
  }
}

main();
