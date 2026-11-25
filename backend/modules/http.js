import { createServer } from "http";
import data from "./data.js";

const server = createServer((request, response) => {
  if(request.url == "/"){
    response.end("HOme page");
  }else if (request.url == "/about"){
    response.end("About page");
  }
else if (request.url == "/contact")
  response.end("contact");
else{
  response.end("page not found")
}

  // else(request.url == "/contact") {
  //   response.end("Contact page")
  // }
});

server.listen(5000, () => {
  console.log("Server running at port 5000...");
});