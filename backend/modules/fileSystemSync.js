//file system module 2 types -Synchronous and Asynchronous
import fs from "fs";

const data=fs.readFileSync("./log.txt","utf8");
console.log(data);

// const img= fs.readFileSync("./logo.jpg","base64")
// console.log(img);


//write
fs.writeFileSync("write.txt","this check is for only check")

//append
fs.appendFileSync("write.txt"," this is for append check")

//delete
// fs.rmSync("write.txt")