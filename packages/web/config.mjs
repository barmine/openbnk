const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://openbnk.local" : `https://${stage}.openbnk.local`,
  console: stage === "production" ? "https://openbnk.local/auth" : `https://${stage}.openbnk.local/auth`,
  email: "help@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/anomalyco/openbnk",
  discord: "https://openbnk.local/discord",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/v2/docs" },
  ],
}
