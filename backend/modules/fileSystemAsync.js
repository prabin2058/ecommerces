
import { error } from "console";
import fs from "fs";
import fsPromise from "fs/promises"

const data = fs.readFile("./log.txt","utf8",(error,data)=>{
    if(error) throw error;

    console.log(data)
});
console.log("hey you")
fs.writeFile("async.txr","hey this is a asynchronous ",() => {})

//promise
fsPromise.readFile("./log.txt","utf8").then((data) => {
    console.log(data);
}).catch((error) => {
    console.error(error);
})
// async/wait 
async function readMyFile(){
    const data = await fsPromise.readFile("./log.txt","utf8");
    console.log(data)
}
readMyFile();