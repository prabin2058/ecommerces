// Local workaround: Node 26 removed buffer.SlowBuffer, which the old
// buffer-equal-constant-time (via jsonwebtoken) still reads at load time.
const buffer = require("buffer");
if (!buffer.SlowBuffer) buffer.SlowBuffer = buffer.Buffer;
