import path from "path";
import url from "url";

const __filename =url.fileURLToPath(import.meta.url)
console.log(__filename);

const __dirname = path.dirname(__filename)
console.log(__dirname);

const myUrl = "https://codeit.com.np/search-course?q=Node+JS"
const urlObject= new URL(myUrl);
console.log(urlObject)


const formattedUrl =url.format(urlObject)
console.log(formattedUrl)

const params= new URLSearchParams(urlObject.search)
console.log(params)

parse.append("duration","2")
console.log(params);