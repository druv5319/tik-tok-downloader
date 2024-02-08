const tiktok = require("tiktok-scraper-without-watermark");
const ObjectsToCsv = require('objects-to-csv');
var fs = require('fs')
const path = require('path');
const creatorsDir = "./creators";

// TODO: Optimize api calls
/*
const Bottleneck = require("bottleneck")
const limiter = new Bottleneck({
    minTime: 500, //minimum time between requests
    maxConcurrent: 20, //maximum concurrent requests
});
*/

async function main(){
    // Fetch all files in /creators and iterate through them
    const files = await fs.promises.readdir(creatorsDir);
    for(const file of files) {
        const creatorVideos = [];
        const filePath = path.join(creatorsDir, file);
        const videoUrls = fs.readFileSync(filePath, 'utf8').toString().split('\n');
        // Iterate, fetch and parse all videos
        for(const videoUrl of videoUrls) {
            try{
                const parsedVideoData =  await fetchParsedVideoData(videoUrl);
                creatorVideos.push(parsedVideoData);
            }
            catch(err) {
                console.error(err);
                console.log(videoUrl);
            }
       }
       const csv = new ObjectsToCsv(creatorVideos);
 
        // Save to file:
        await csv.toDisk(file.replace(".txt", ".csv"));
    }
    
}
main();


async function fetchParsedVideoData(videoUrl) {
    const metadata = await tiktok.tiklydown(videoUrl);
    const videoInfo = {
        "ID": metadata.id,
        "Title": metadata.title,
        "Creator": metadata.author.unique_id,
        "Views": metadata.stats.playCount,
        "Likes": metadata.likeCount,
        "Tiktok URL": metadata.url,
        "Download URL": metadata.video.noWatermark
    }
    return videoInfo;
}



// TODO: Optimize api calls

/*
async function getAllVideoDetails(videoUrls) {
    const errors = [];
  
    const videoPromises = videoUrls.map(url => {
        return scheduleRequest(url);
    });
    const videoDetails = await promiseAll(videoPromises, errors);
  
    return {
        videoDetails,
      errors
    };

}
function scheduleRequest(videoUrl) {
    return limiter.schedule(()=>{
      return tiktok.tiklydown(videoUrl);
    })
}
function promiseAll(promises, errors) {
  
    return Promise.all(promises.map(p => {
      console.log(p)
      return p.catch(e  => {
        
        errors.push(e.response);
        
        return null;
        
      })
      
    }))
}
*/

