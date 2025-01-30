const cron = require("node-cron");
const { endAuctions } = require("./controllers/auctionController");

cron.schedule("* * * * *", async () => {
  console.log("Checking expired auctions...");
  await endAuctions();
});
