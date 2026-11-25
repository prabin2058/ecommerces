import { error } from "console";
import fsPromise from "fs/promises";

fsPromise
  .readFile("../data/users.json", "utf8")
  .then((users) => {
    console.log(users);
    const parsedUsers = JSON.parse(users)

   return fsPromise
      .readFile("../data/posts.json", "utf8")
      .then((posts) => {
        const parsedPosts = JSON.parse(posts);
        return{parsedPosts,parsedUsers}
      }); 
  })
  .then(({parsedPosts,parsedUsers}) => {
    const result = parsedUsers.map((user) => {
        return {
          ...user,
          posts: parsedPosts.filter((post) => post.userId == user.id),
        };
      });
      console.log(result);
  })
  .catch((error) => {
    console.error(error);
  });
