import path, { join } from "path"

const filePath="./path1/path2/path3/file.png";

const basename= path.basename(filePath)
console.log(basename) // outputs: file.txt

const extension =path.extname(filePath);
console.log(extension) // outputs: .txt

//dirname
const dirname = path.dirname(filePath);
console.log(dirname) // outputs: ./path1/path2/path3

const newPath= path.join(dirname,"path4")
console.log(newPath) // outputs: ./path1/path2/path3/path4

console.log(path.parse(filePath));