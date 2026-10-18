const app = require("./app");

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
        console.error(`To fix this, stop the running process on port ${PORT} or run:`);
        console.error(`Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
    } else {
        console.error("Server error:", error.message);
    }
    process.exit(1);
});

module.exports = server;
